import { betterAuth } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { organization, twoFactor } from 'better-auth/plugins'
import { Resend } from 'resend'
import bcrypt from 'bcrypt'
import { prisma } from './prisma.js'
import { logger } from './logger.js'
import { checkLoginAllowed, recordFailedAttempt, clearFailedAttempts, MAX_ATTEMPTS } from './login-limiter.js'
import { auditService } from '../services/audit.js'
import { invalidateOtherSessions } from '../services/session.service.js'
import { notifyNewUser } from './telegram.js'

const BCRYPT_ROUNDS = 12 // Industry standard for 2025

// Initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const emailFrom = process.env.EMAIL_FROM || 'noreply@agentgov.dev'
const webUrl = process.env.WEB_URL || 'http://localhost:3000'

/**
 * Send email via Resend or log to console in development
 */
async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (resend) {
    try {
      await resend.emails.send({
        from: emailFrom,
        to: params.to,
        subject: params.subject,
        html: params.html,
      })
    } catch (error) {
      logger.error({ err: error }, '[Email] Failed to send')
    }
  } else {
    // Development mode - log email details (with partially masked email for privacy)
    const maskedEmail = params.to.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    logger.info({ to: maskedEmail, subject: params.subject }, '[Email] Would send (dev mode)')
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Database hooks for session invalidation on password change
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          logger.info({ userId: user.id, email: user.email }, '[Auth] New user registered')
          notifyNewUser({ name: user.name, email: user.email })
        },
      },
    },
    account: {
      update: {
        after: async (account, ctx) => {
          // Detect password change (credential account with password field updated)
          if (account.providerId === 'credential' && account.password) {
            // Extract current session token from GenericEndpointContext
            // so we can preserve the session of the user who changed their password
            const endpointCtx = ctx as { context?: { session?: { session?: { token?: string } } } } | null
            const currentSessionToken = endpointCtx?.context?.session?.session?.token

            logger.info(
              { userId: account.userId, preservingCurrentSession: !!currentSessionToken },
              '[Auth] Password changed — invalidating other sessions'
            )

            void invalidateOtherSessions(account.userId, currentSessionToken)

            void auditService.log({
              action: 'user.password_changed',
              userId: account.userId,
              resourceType: 'user',
              resourceId: account.userId,
              metadata: { reason: 'password_changed_sessions_invalidated' },
            })
          }
        },
      },
    },
  },

  // Base URL
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET,

  // Trusted origins for CORS and CSRF protection
  trustedOrigins: [
    webUrl,
    process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  ],

  // Email & Password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 3600, // 1 hour
    // Use bcrypt for secure password hashing (industry standard)
    password: {
      hash: async (password: string) => {
        return bcrypt.hash(password, BCRYPT_ROUNDS)
      },
      verify: async ({ hash, password }: { hash: string; password: string }) => {
        return bcrypt.compare(password, hash)
      },
    },
    sendResetPassword: async ({ user, url }) => {
      // Don't await to prevent timing attacks
      void sendEmail({
        to: user.email,
        subject: 'Reset your AgentGov password',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7C3AED;">Reset Your Password</h1>
            <p>Hi ${user.name || 'there'},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="margin: 30px 0;">
              <a href="${url}" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">
              AgentGov - AI Agent Governance Platform
            </p>
          </div>
        `,
      })
    },
  },

  // Email verification
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: 'Verify your AgentGov email',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7C3AED;">Verify Your Email</h1>
            <p>Hi ${user.name || 'there'},</p>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="margin: 30px 0;">
              <a href="${url}" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If you didn't create an account, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #999; font-size: 12px;">
              AgentGov - AI Agent Governance Platform
            </p>
          </div>
        `,
      })
    },
  },

  // OAuth providers (optional - enable when credentials are set)
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        // Force account selection on each login
        prompt: 'select_account',
      },
    }),
    ...(process.env.GITHUB_CLIENT_ID && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Plugins
  plugins: [
    // Organization plugin for multi-tenancy
    organization({
      invitationExpiresIn: 48 * 60 * 60, // 48 hours
      async sendInvitationEmail(data) {
        const { email, organization: org, inviter } = data
        const inviteUrl = `${webUrl}/accept-invitation?id=${data.id}`

        void sendEmail({
          to: email,
          subject: `You've been invited to join ${org.name} on AgentGov`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #7C3AED;">You're Invited!</h1>
              <p>Hi there,</p>
              <p><strong>${inviter.user.name || inviter.user.email}</strong> has invited you to join <strong>${org.name}</strong> on AgentGov.</p>
              <div style="margin: 30px 0;">
                <a href="${inviteUrl}" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                This invitation will expire in 48 hours.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="color: #999; font-size: 12px;">
                AgentGov - AI Agent Governance Platform
              </p>
            </div>
          `,
        })
      },
    }),

    // Two-Factor authentication
    twoFactor({
      issuer: 'AgentGov',
      totpOptions: {
        digits: 6,
        period: 30,
      },
      backupCodeOptions: {
        length: 10,
        count: 10,
      },
    }),
  ],

  // Advanced options
  advanced: {
    cookiePrefix: 'agentgov',
    // Secure cookie configuration for cross-site OAuth
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
    // Cross-subdomain cookies for api.agentgov.co ↔ www.agentgov.co
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === 'production',
      domain: process.env.COOKIE_DOMAIN || undefined, // .agentgov.co in production
    },
  },

  // Hooks for brute-force protection
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return

      const body = ctx.body as { email?: string } | undefined
      const email = body?.email
      if (!email) return

      const { allowed, retryAfterSeconds } = await checkLoginAllowed(email)
      if (!allowed) {
        logger.warn({ email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') }, '[Auth] Login blocked - account locked')

        void auditService.log({
          action: 'user.account_locked',
          resourceType: 'user',
          metadata: { reason: 'max_attempts_exceeded', retryAfterSeconds },
        })

        return ctx.json({
          error: 'Too many failed attempts',
          code: 'ACCOUNT_LOCKED',
          message: `Account temporarily locked. Try again in ${Math.ceil((retryAfterSeconds || 900) / 60)} minutes.`,
        }, { status: 429 })
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return

      const body = ctx.body as { email?: string } | undefined
      const email = body?.email
      if (!email) return

      try {
        // newSession is set by better-auth on successful sign-in
        // This is the canonical way to detect login success (per better-auth docs)
        const newSession = ctx.context?.newSession as { user?: { id: string } } | null | undefined

        if (newSession?.user) {
          // Successful login — clear failed attempts
          await clearFailedAttempts(email)
        } else {
          // Failed login — record attempt
          const count = await recordFailedAttempt(email)

          void auditService.log({
            action: 'user.login_failed',
            resourceType: 'user',
            metadata: { attemptCount: count },
          })

          if (count >= MAX_ATTEMPTS) {
            void auditService.log({
              action: 'user.account_locked',
              resourceType: 'user',
              metadata: { reason: 'max_attempts_reached', attemptCount: count },
            })
          }
        }
      } catch (err) {
        // Never let hook errors break the auth flow
        logger.error({ err }, '[LoginLimiter] After hook error')
      }
    }),
  },
})

export type Auth = typeof auth
