import { describe, it, expect, vi, beforeEach } from 'vitest'
import { forgetPassword, resetPassword } from './auth-client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('auth-client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('forgetPassword', () => {
    it('sends password reset request successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const result = await forgetPassword({
        email: 'test@example.com',
        redirectTo: '/reset-password',
      })

      expect(result.error).toBeNull()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/request-password-reset'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            redirectTo: '/reset-password',
          }),
          credentials: 'include',
        })
      )
    })

    it('handles error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'User not found' }),
      })

      const result = await forgetPassword({
        email: 'unknown@example.com',
      })

      expect(result.error).toEqual({ message: 'User not found' })
    })

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await forgetPassword({
        email: 'test@example.com',
      })

      expect(result.error).toEqual({ message: 'An error occurred' })
    })
  })

  describe('resetPassword', () => {
    it('resets password successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const result = await resetPassword({
        newPassword: 'newPassword123',
        token: 'valid-token',
      })

      expect(result.error).toBeNull()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/reset-password'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newPassword: 'newPassword123',
            token: 'valid-token',
          }),
          credentials: 'include',
        })
      )
    })

    it('handles invalid token error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid or expired token' }),
      })

      const result = await resetPassword({
        newPassword: 'newPassword123',
        token: 'invalid-token',
      })

      expect(result.error).toEqual({ message: 'Invalid or expired token' })
    })

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await resetPassword({
        newPassword: 'newPassword123',
        token: 'valid-token',
      })

      expect(result.error).toEqual({ message: 'An error occurred' })
    })
  })
})
