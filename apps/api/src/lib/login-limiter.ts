import { createHash } from 'crypto'
import { getRedisClient } from './redis.js'
import { logger } from './logger.js'

const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 900 // 15 minutes
const KEY_PREFIX = 'login:attempts:'

function emailKey(email: string): string {
  const hash = createHash('sha256').update(email.toLowerCase()).digest('hex')
  return `${KEY_PREFIX}${hash}`
}

/**
 * Check if login is allowed for the given email.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 * Fails open if Redis is unavailable (returns allowed).
 */
export async function checkLoginAllowed(email: string): Promise<{
  allowed: boolean
  retryAfterSeconds?: number
}> {
  const client = getRedisClient()
  if (!client) {
    return { allowed: true }
  }

  try {
    const key = emailKey(email)
    const attempts = await client.get(key)

    if (attempts !== null && parseInt(attempts, 10) >= MAX_ATTEMPTS) {
      const ttl = await client.ttl(key)
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : LOCKOUT_SECONDS }
    }

    return { allowed: true }
  } catch (err) {
    logger.error({ err }, '[LoginLimiter] Redis check failed, failing open')
    return { allowed: true }
  }
}

/**
 * Record a failed login attempt. Increments a counter with a 15-minute TTL.
 * Returns the new attempt count.
 */
export async function recordFailedAttempt(email: string): Promise<number> {
  const client = getRedisClient()
  if (!client) {
    return 0
  }

  try {
    const key = emailKey(email)
    const count = await client.incr(key)

    // Set TTL only on the first attempt (when key is freshly created)
    if (count === 1) {
      await client.expire(key, LOCKOUT_SECONDS)
    }

    return count
  } catch (err) {
    logger.error({ err }, '[LoginLimiter] Redis record failed')
    return 0
  }
}

/**
 * Clear failed attempts on successful login.
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  const client = getRedisClient()
  if (!client) {
    return
  }

  try {
    await client.del(emailKey(email))
  } catch (err) {
    logger.error({ err }, '[LoginLimiter] Redis clear failed')
  }
}

export { MAX_ATTEMPTS, LOCKOUT_SECONDS }
