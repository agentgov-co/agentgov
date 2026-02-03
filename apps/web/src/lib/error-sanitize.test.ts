import { describe, it, expect } from 'vitest'
import { sanitizeApiError, STATUS_MESSAGES } from './api'

/**
 * AC-2.6: Error message sanitization
 *
 * Tests the real sanitizeApiError() and STATUS_MESSAGES from @/lib/api.
 * Also tests the API-side sanitizeErrorMessage() from @agentgov/api.
 */

// Import the API-side function (separate package)
import { sanitizeErrorMessage } from '../../../api/src/lib/error-sanitize'

describe('AC-2.6: API sanitizeErrorMessage', () => {
  it('should return generic message for 500 errors', () => {
    expect(sanitizeErrorMessage('Connection pool exhausted', 500)).toBe(
      'An unexpected error occurred'
    )
  })

  it('should return generic message for 502/503', () => {
    expect(sanitizeErrorMessage('upstream timeout', 502)).toBe('An unexpected error occurred')
    expect(sanitizeErrorMessage('service unavailable', 503)).toBe('An unexpected error occurred')
  })

  it('should strip SQL syntax errors', () => {
    expect(
      sanitizeErrorMessage('SQL syntax error near SELECT * FROM users WHERE id = 1', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should strip INSERT/UPDATE/DELETE queries', () => {
    expect(
      sanitizeErrorMessage('Error in INSERT INTO users (name) VALUES ($1)', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should strip JOIN fragments (case-insensitive)', () => {
    expect(
      sanitizeErrorMessage('Error: relation "users" does not exist — FROM users JOIN roles', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should strip file paths with line numbers', () => {
    expect(
      sanitizeErrorMessage('TypeError at /app/src/routes/users.ts:42', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should strip .js and .mjs paths', () => {
    expect(
      sanitizeErrorMessage('Error in /dist/index.js:100', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should strip stack trace frames', () => {
    expect(
      sanitizeErrorMessage('TypeError: Cannot read property "x" at Object.handler (/app/src/routes.ts:10:5)', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should strip Prisma operation details', () => {
    expect(
      sanitizeErrorMessage('prisma.user.findUnique() failed: unique constraint', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should strip ECONNREFUSED', () => {
    expect(
      sanitizeErrorMessage('connect ECONNREFUSED 127.0.0.1:5432', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should strip ETIMEDOUT', () => {
    expect(
      sanitizeErrorMessage('connect ETIMEDOUT 10.0.0.1:6379', 400)
    ).toBe('An error occurred while processing your request')
  })

  it('should pass through safe 4xx messages', () => {
    expect(sanitizeErrorMessage('Invalid email format', 400)).toBe('Invalid email format')
  })

  it('should pass through "Not found" messages', () => {
    expect(sanitizeErrorMessage('API key not found', 404)).toBe('API key not found')
  })

  it('should pass through validation messages', () => {
    expect(sanitizeErrorMessage('Name must be at least 1 character', 400)).toBe(
      'Name must be at least 1 character'
    )
  })
})

describe('AC-2.6: Web sanitizeApiError', () => {
  it('should return "Something went wrong" for 500', () => {
    expect(sanitizeApiError(500, 'SQL syntax error near SELECT')).toBe(
      'Something went wrong. Please try again later.'
    )
  })

  it('should return "Service temporarily unavailable" for 502', () => {
    expect(sanitizeApiError(502)).toBe(
      'Service temporarily unavailable. Please try again later.'
    )
  })

  it('should return generic message for unknown 5xx', () => {
    expect(sanitizeApiError(599)).toBe('Something went wrong. Please try again later.')
  })

  it('API "SQL syntax error near..." → UI shows "Something went wrong"', () => {
    expect(sanitizeApiError(500, 'SQL syntax error near SELECT * FROM users')).toBe(
      'Something went wrong. Please try again later.'
    )
  })

  it('should strip file paths from 4xx server messages', () => {
    const result = sanitizeApiError(400, 'Error at /app/src/routes/api.ts:42')
    expect(result).toBe(STATUS_MESSAGES[400])
  })

  it('should strip Prisma details from 4xx server messages', () => {
    const result = sanitizeApiError(400, 'prisma.user failed')
    expect(result).toBe(STATUS_MESSAGES[400])
  })

  it('should strip SQL fragments from 4xx server messages', () => {
    const result = sanitizeApiError(400, 'Invalid WHERE clause in query')
    expect(result).toBe(STATUS_MESSAGES[400])
  })

  it('should strip stack traces from 4xx server messages', () => {
    const result = sanitizeApiError(400, 'Error at handler (/app/src/routes.ts:10)')
    expect(result).toBe(STATUS_MESSAGES[400])
  })

  it('should pass through safe 400 messages', () => {
    expect(sanitizeApiError(400, 'Email is required')).toBe('Email is required')
  })

  it('should pass through safe 404 messages', () => {
    expect(sanitizeApiError(404, 'Project not found')).toBe('Project not found')
  })

  it('should pass through safe 409 messages', () => {
    expect(sanitizeApiError(409, 'Slug already taken')).toBe('Slug already taken')
  })

  it('should use STATUS_MESSAGES when no server message provided', () => {
    expect(sanitizeApiError(401)).toBe(STATUS_MESSAGES[401])
    expect(sanitizeApiError(403)).toBe(STATUS_MESSAGES[403])
    expect(sanitizeApiError(429)).toBe(STATUS_MESSAGES[429])
  })

  it('should return generic fallback for unknown 4xx status', () => {
    expect(sanitizeApiError(418)).toBe('Request failed (418).')
  })
})
