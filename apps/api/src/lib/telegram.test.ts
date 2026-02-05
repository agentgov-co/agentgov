import { describe, it, expect } from 'vitest'
import { __testing } from './telegram.js'

const { calculateBackoff, escapeHtml, formatTimestamp, formatNotification } = __testing

describe('telegram', () => {
  describe('calculateBackoff', () => {
    it('increases exponentially with attempt number', () => {
      const attempt0 = calculateBackoff(0)
      const attempt1 = calculateBackoff(1)
      const attempt2 = calculateBackoff(2)

      // Base delay is 1000ms, so:
      // attempt 0: ~1000ms + jitter
      // attempt 1: ~2000ms + jitter
      // attempt 2: ~4000ms + jitter
      expect(attempt0).toBeGreaterThanOrEqual(1000)
      expect(attempt0).toBeLessThan(1200) // 1000 + max 100 jitter + buffer

      expect(attempt1).toBeGreaterThanOrEqual(2000)
      expect(attempt1).toBeLessThan(2200)

      expect(attempt2).toBeGreaterThanOrEqual(4000)
      expect(attempt2).toBeLessThan(4200)
    })

    it('caps at 30 seconds', () => {
      const result = calculateBackoff(10) // 2^10 * 1000 = 1024000ms
      expect(result).toBeLessThanOrEqual(30100) // 30000 + max jitter
    })

    it('includes jitter for randomness', () => {
      // Run multiple times and check values differ
      const results = new Set<number>()
      for (let i = 0; i < 10; i++) {
        results.add(Math.floor(calculateBackoff(0)))
      }
      // With jitter, we should have some variation
      expect(results.size).toBeGreaterThan(1)
    })
  })

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar')
    })

    it('escapes less than', () => {
      expect(escapeHtml('a < b')).toBe('a &lt; b')
    })

    it('escapes greater than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b')
    })

    it('escapes all special characters together', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert("xss")&lt;/script&gt;'
      )
    })

    it('handles empty string', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('preserves normal text', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })
  })

  describe('formatTimestamp', () => {
    it('returns ISO format with UTC suffix', () => {
      const result = formatTimestamp()
      // Format: "2026-02-05 12:34:56 UTC"
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/)
    })
  })

  describe('formatNotification', () => {
    describe('user.registered', () => {
      it('formats user registration notification', () => {
        const result = formatNotification({
          type: 'user.registered',
          user: { name: 'John Doe', email: 'john@example.com' },
        })

        expect(result).toContain('<b>New User Registration</b>')
        expect(result).toContain('<b>Name:</b> John Doe')
        expect(result).toContain('<b>Email:</b> john@example.com')
        expect(result).toContain('<b>Time:</b>')
        expect(result).toContain('UTC')
      })

      it('escapes HTML in user data', () => {
        const result = formatNotification({
          type: 'user.registered',
          user: { name: '<script>alert(1)</script>', email: 'test@example.com' },
        })

        expect(result).toContain('&lt;script&gt;')
        expect(result).not.toContain('<script>')
      })
    })

    describe('feedback.created', () => {
      it('formats bug report', () => {
        const result = formatNotification({
          type: 'feedback.created',
          feedback: { type: 'BUG', message: 'Something broke', page: '/dashboard' },
          user: { name: 'Jane', email: 'jane@example.com' },
        })

        expect(result).toContain('<b>Bug Report</b>')
        expect(result).toContain('from Jane')
        expect(result).toContain('<b>Page:</b> /dashboard')
        expect(result).toContain('Something broke')
      })

      it('formats feature request', () => {
        const result = formatNotification({
          type: 'feedback.created',
          feedback: { type: 'FEATURE', message: 'Add dark mode' },
          user: { name: 'Bob', email: 'bob@example.com' },
        })

        expect(result).toContain('<b>Feature Request</b>')
        expect(result).toContain('Add dark mode')
      })

      it('formats improvement', () => {
        const result = formatNotification({
          type: 'feedback.created',
          feedback: { type: 'IMPROVEMENT', message: 'Make it faster' },
          user: { name: 'Alice', email: 'alice@example.com' },
        })

        expect(result).toContain('<b>Improvement</b>')
      })

      it('formats other feedback', () => {
        const result = formatNotification({
          type: 'feedback.created',
          feedback: { type: 'OTHER', message: 'Just saying hi' },
          user: { name: 'Charlie', email: 'charlie@example.com' },
        })

        expect(result).toContain('<b>Feedback</b>')
      })

      it('handles missing page', () => {
        const result = formatNotification({
          type: 'feedback.created',
          feedback: { type: 'BUG', message: 'Error occurred' },
          user: { name: 'Dave', email: 'dave@example.com' },
        })

        expect(result).not.toContain('<b>Page:</b>')
      })

      it('handles null page', () => {
        const result = formatNotification({
          type: 'feedback.created',
          feedback: { type: 'BUG', message: 'Error occurred', page: null },
          user: { name: 'Eve', email: 'eve@example.com' },
        })

        expect(result).not.toContain('<b>Page:</b>')
      })

      it('escapes HTML in feedback message', () => {
        const result = formatNotification({
          type: 'feedback.created',
          feedback: { type: 'BUG', message: '<img src=x onerror=alert(1)>' },
          user: { name: 'Hacker', email: 'h@x.com' },
        })

        expect(result).toContain('&lt;img')
        expect(result).not.toContain('<img')
      })
    })
  })
})
