import { describe, it, expect, beforeEach, vi } from 'vitest'

const ONE_HOUR = 60 * 60 * 1000

// Mock stale traces (updatedAt > 1 hour ago)
const mockStaleTraces = [
  { id: 'trace_stale_1', projectId: 'proj_1' },
  { id: 'trace_stale_2', projectId: 'proj_1' },
  { id: 'trace_stale_3', projectId: 'proj_2' },
]

let findManyCallCount = 0

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    trace: {
      findMany: vi.fn(() => {
        findManyCallCount++
        // Return stale traces on first call, empty on second
        if (findManyCallCount === 1) {
          return Promise.resolve(mockStaleTraces)
        }
        return Promise.resolve([])
      }),
      updateMany: vi.fn(() => Promise.resolve({ count: mockStaleTraces.length })),
    },
  },
}))

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock websocket manager
vi.mock('../lib/websocket-manager.js', () => ({
  wsManager: {
    notifyTraceUpdated: vi.fn(),
  },
}))

// Mock redis
vi.mock('../lib/redis.js', () => ({
  cacheDeletePattern: vi.fn(() => Promise.resolve()),
  CACHE_KEYS: {
    TRACES_LIST: 'traces:list:',
  },
}))

// Import after mocks
import { runStaleTracesCleanup, STALE_TRACE_TIMEOUT_MS } from './stale-traces-cleanup.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { wsManager } from '../lib/websocket-manager.js'
import { cacheDeletePattern, CACHE_KEYS } from '../lib/redis.js'

describe('Stale Traces Cleanup Job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyCallCount = 0
  })

  it('should have a 1-hour timeout', () => {
    expect(STALE_TRACE_TIMEOUT_MS).toBe(ONE_HOUR)
  })

  it('should find and update stale RUNNING traces to FAILED', async () => {
    await runStaleTracesCleanup()

    // Should query for RUNNING traces with old updatedAt
    expect(prisma.trace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'RUNNING',
          updatedAt: { lt: expect.any(Date) },
        },
        select: { id: true, projectId: true },
        take: 500,
      })
    )

    // Should batch update to FAILED with endedAt
    expect(prisma.trace.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['trace_stale_1', 'trace_stale_2', 'trace_stale_3'] } },
      data: { status: 'FAILED', endedAt: expect.any(Date) },
    })
  })

  it('should send WebSocket notifications for each updated trace', async () => {
    await runStaleTracesCleanup()

    expect(wsManager.notifyTraceUpdated).toHaveBeenCalledTimes(3)

    expect(wsManager.notifyTraceUpdated).toHaveBeenCalledWith({
      id: 'trace_stale_1',
      projectId: 'proj_1',
      status: 'FAILED',
      endTime: expect.any(String),
    })

    expect(wsManager.notifyTraceUpdated).toHaveBeenCalledWith({
      id: 'trace_stale_3',
      projectId: 'proj_2',
      status: 'FAILED',
      endTime: expect.any(String),
    })
  })

  it('should invalidate Redis cache for affected projects', async () => {
    await runStaleTracesCleanup()

    // Two unique projects: proj_1 and proj_2
    expect(cacheDeletePattern).toHaveBeenCalledTimes(2)
    expect(cacheDeletePattern).toHaveBeenCalledWith(`${CACHE_KEYS.TRACES_LIST}proj_1:*`)
    expect(cacheDeletePattern).toHaveBeenCalledWith(`${CACHE_KEYS.TRACES_LIST}proj_2:*`)
  })

  it('should log total closed count on completion', async () => {
    await runStaleTracesCleanup()

    expect(logger.info).toHaveBeenCalledWith('[StaleTraces] Starting cleanup job')
    expect(logger.info).toHaveBeenCalledWith(
      { totalClosed: 3 },
      '[StaleTraces] Cleanup job completed'
    )
  })

  it('should be a no-op when no stale traces exist', async () => {
    vi.mocked(prisma.trace.findMany).mockResolvedValueOnce([])

    await runStaleTracesCleanup()

    expect(prisma.trace.updateMany).not.toHaveBeenCalled()
    expect(wsManager.notifyTraceUpdated).not.toHaveBeenCalled()
    expect(cacheDeletePattern).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      { totalClosed: 0 },
      '[StaleTraces] Cleanup job completed'
    )
  })

  it('should process multiple batches', async () => {
    // First call returns full batch, second returns remainder, third returns empty
    const fullBatch = Array.from({ length: 500 }, (_, i) => ({
      id: `trace_batch_${i}`,
      projectId: 'proj_batch',
    }))
    const remainderBatch = [{ id: 'trace_remainder', projectId: 'proj_batch' }]

    const mockedFindMany = vi.mocked(prisma.trace.findMany)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedFindMany.mockResolvedValueOnce(fullBatch as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedFindMany.mockResolvedValueOnce(remainderBatch as any)
    mockedFindMany.mockResolvedValueOnce([])

    await runStaleTracesCleanup()

    // Two updateMany calls (one per non-empty batch)
    expect(prisma.trace.updateMany).toHaveBeenCalledTimes(2)

    expect(logger.info).toHaveBeenCalledWith(
      { totalClosed: 501 },
      '[StaleTraces] Cleanup job completed'
    )
  })
})

describe('Stale Traces Cleanup Job - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyCallCount = 0
  })

  it('should log error and rethrow on failure', async () => {
    const mockFindMany = vi.mocked(prisma.trace.findMany)
    mockFindMany.mockReset()
    mockFindMany.mockRejectedValueOnce(new Error('Database connection failed'))

    await expect(runStaleTracesCleanup()).rejects.toThrow('Database connection failed')

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      '[StaleTraces] Cleanup job failed'
    )
  })
})
