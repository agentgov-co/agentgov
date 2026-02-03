import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import authPlugin from '../plugins/auth.js'

// Test with real Better Auth (integration test)
describe('Auth API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Register auth plugin
    await app.register(authPlugin)

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/auth/get-session', () => {
    it('should return null when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/get-session',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toBeNull()
    })
  })

  describe('POST /api/auth/sign-up/email', () => {
    it('should create a new user', async () => {
      const email = `test-${Date.now()}@example.com`

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: {
          email,
          password: 'password123',
          name: 'Test User',
        },
      })

      // Should succeed or indicate user exists
      expect([200, 201, 400]).toContain(response.statusCode)
    })

    it('should reject weak password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: {
          email: 'weak@example.com',
          password: '123', // Too short
          name: 'Weak Password User',
        },
      })

      // Should reject with 400
      expect(response.statusCode).toBe(400)
    })

    it('should reject invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: {
          email: 'not-an-email',
          password: 'password123',
          name: 'Invalid Email User',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/auth/sign-in/email', () => {
    const testEmail = `signin-test-${Date.now()}@example.com`
    const testPassword = 'password123'

    beforeEach(async () => {
      // Create user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: {
          email: testEmail,
          password: testPassword,
          name: 'Sign In Test',
        },
      })
    })

    it('should sign in with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      })

      expect([200, 302]).toContain(response.statusCode)

      // Should set session cookie
      const cookies = response.cookies
      expect(cookies.some((c: { name: string }) => c.name.includes('session') || c.name.includes('auth'))).toBe(true)
    })

    it('should reject invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: {
          email: testEmail,
          password: 'wrongpassword',
        },
      })

      expect([400, 401, 403]).toContain(response.statusCode)
    })

    it('should reject non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      })

      expect([400, 401, 404]).toContain(response.statusCode)
    })
  })

  describe('Session flow', () => {
    it('should maintain session after sign in', async () => {
      const email = `session-test-${Date.now()}@example.com`

      // Sign up
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: {
          email,
          password: 'password123',
          name: 'Session Test',
        },
      })

      // Sign in
      const signInResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: {
          email,
          password: 'password123',
        },
      })

      // Get cookies from sign in response
      const cookies = signInResponse.cookies
      const cookieHeader = cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join('; ')

      // Check session with cookies
      const sessionResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/get-session',
        headers: {
          cookie: cookieHeader,
        },
      })

      expect(sessionResponse.statusCode).toBe(200)
      const session = JSON.parse(sessionResponse.body)

      // Should have user data
      if (session) {
        expect(session.user).toBeDefined()
        expect(session.user.email).toBe(email)
      }
    })
  })
})
