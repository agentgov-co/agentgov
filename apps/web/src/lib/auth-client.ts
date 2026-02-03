import { createAuthClient } from 'better-auth/react'
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins'

// Use relative URL to go through Next.js proxy (rewrites in next.config.ts)
// This ensures cookies are set on the frontend domain
const getBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin // Use frontend domain for auth
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    organizationClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = '/two-factor'
      },
    }),
  ],
})

// Export hooks for easy usage
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  organization,
  twoFactor,
} = authClient

// Password reset functions - use fetch through proxy
// Better Auth uses /request-password-reset endpoint (not /forget-password)
export async function forgetPassword(params: { email: string; redirectTo?: string }): Promise<{ data: unknown; error: { message: string } | null }> {
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
    const response = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      credentials: 'include',
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { data: null, error: { message: data.message || 'Failed to send reset email' } }
    }

    const data = await response.json().catch(() => ({}))
    return { data, error: null }
  } catch {
    return { data: null, error: { message: 'An error occurred' } }
  }
}

export async function resetPassword(params: { newPassword: string; token: string }): Promise<{ data: unknown; error: { message: string } | null }> {
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      credentials: 'include',
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { data: null, error: { message: data.message || 'Failed to reset password' } }
    }

    const data = await response.json().catch(() => ({}))
    return { data, error: null }
  } catch {
    return { data: null, error: { message: 'An error occurred' } }
  }
}

// Types
export type Session = typeof authClient.$Infer.Session
export type User = Session['user']
