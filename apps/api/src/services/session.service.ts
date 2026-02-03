import { prisma } from '../lib/prisma.js'
import { cacheDeletePattern, CACHE_KEYS } from '../lib/redis.js'
import { logger } from '../lib/logger.js'

/**
 * Invalidate all sessions for a user except the current one.
 * Used after password change to force re-authentication on other devices.
 */
export async function invalidateOtherSessions(
  userId: string,
  currentSessionToken?: string
): Promise<number> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        userId,
        ...(currentSessionToken ? { token: { not: currentSessionToken } } : {}),
      },
    })

    // Clear session cache in Redis
    await cacheDeletePattern(`${CACHE_KEYS.SESSION}*`)

    logger.info(
      { userId, deletedCount: result.count },
      '[Session] Invalidated other sessions after password change'
    )

    return result.count
  } catch (err) {
    logger.error({ err, userId }, '[Session] Failed to invalidate sessions')
    return 0
  }
}
