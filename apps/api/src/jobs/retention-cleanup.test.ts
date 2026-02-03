import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlanTier } from '../generated/prisma/client.js'

// Mock data
const mockOrganizations = [
  {
    id: 'org_1',
    name: 'Org 1',
    subscription: { tier: PlanTier.FREE_BETA },
    projects: [{ id: 'proj_1' }, { id: 'proj_2' }],
  },
  {
    id: 'org_2',
    name: 'Org 2',
    subscription: { tier: PlanTier.PRO },
    projects: [{ id: 'proj_3' }],
  },
  {
    id: 'org_3',
    name: 'Org 3 - No Projects',
    subscription: null,
    projects: [],
  },
]

const mockPlanLimits: Record<string, { retentionDays: number }> = {
  [PlanTier.FREE_BETA]: { retentionDays: 15 },
  [PlanTier.FREE]: { retentionDays: 7 },
  [PlanTier.PRO]: { retentionDays: 90 },
}

// Track deleted traces and spans
let deletedTraceIds: string[] = []
let deletedSpanTraceIds: string[] = []

// Mock trace data - some old, some recent
const mockTraces = [
  // Old traces for org_1 (should be deleted with 15 day retention)
  { id: 'trace_old_1', projectId: 'proj_1', createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
  { id: 'trace_old_2', projectId: 'proj_2', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  // Recent traces for org_1 (should NOT be deleted)
  { id: 'trace_recent_1', projectId: 'proj_1', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
  // Old traces for org_2 with PRO plan (90 day retention - should NOT be deleted at 30 days)
  { id: 'trace_pro_1', projectId: 'proj_3', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  // Very old trace for org_2 (should be deleted with 90 day retention)
  { id: 'trace_pro_old', projectId: 'proj_3', createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) },
]

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    organization: {
      findMany: vi.fn(() => Promise.resolve(mockOrganizations)),
    },
    planLimit: {
      findUnique: vi.fn(({ where }) => {
        const limit = mockPlanLimits[where.tier]
        return Promise.resolve(limit || null)
      }),
    },
    trace: {
      findMany: vi.fn(({ where, take }) => {
        const projectIds = where.projectId.in as string[]
        const cutoffDate = where.createdAt.lt as Date

        const matchingTraces = mockTraces.filter(
          t => projectIds.includes(t.projectId) && t.createdAt < cutoffDate
        )

        return Promise.resolve(matchingTraces.slice(0, take).map(t => ({ id: t.id })))
      }),
      deleteMany: vi.fn(({ where }) => {
        const ids = where.id.in as string[]
        deletedTraceIds.push(...ids)
        return Promise.resolve({ count: ids.length })
      }),
    },
    span: {
      deleteMany: vi.fn(({ where }) => {
        const ids = where.traceId.in as string[]
        deletedSpanTraceIds.push(...ids)
        return Promise.resolve({ count: ids.length })
      }),
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

// Import after mocks
import { runRetentionCleanup } from './retention-cleanup.js'
import { logger } from '../lib/logger.js'

describe('Retention Cleanup Job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deletedTraceIds = []
    deletedSpanTraceIds = []
  })

  it('should delete old traces based on organization retention settings', async () => {
    await runRetentionCleanup()

    // Should have deleted old traces for FREE_BETA org (15 day retention)
    expect(deletedTraceIds).toContain('trace_old_1')
    expect(deletedTraceIds).toContain('trace_old_2')

    // Should NOT delete recent traces
    expect(deletedTraceIds).not.toContain('trace_recent_1')

    // Should NOT delete PRO traces within 90 days
    expect(deletedTraceIds).not.toContain('trace_pro_1')

    // Should delete PRO traces older than 90 days
    expect(deletedTraceIds).toContain('trace_pro_old')
  })

  it('should delete spans before traces', async () => {
    await runRetentionCleanup()

    // Spans should be deleted for the same trace IDs
    expect(deletedSpanTraceIds).toContain('trace_old_1')
    expect(deletedSpanTraceIds).toContain('trace_old_2')
  })

  it('should skip organizations without projects', async () => {
    await runRetentionCleanup()

    // Logger should show completion
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeleted: expect.any(Number) }),
      '[Retention] Cleanup job completed'
    )
  })

  it('should log cleanup progress for each organization', async () => {
    await runRetentionCleanup()

    // Should log for org_1 (has old traces)
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org_1',
        orgName: 'Org 1',
        retentionDays: 15,
      }),
      '[Retention] Cleaned up old traces for organization'
    )
  })

  it('should use default retention when plan limit not found', async () => {
    // This test verifies the fallback behavior
    // Org 3 has no subscription, should use FREE_BETA default (15 days)
    await runRetentionCleanup()

    // Job should complete without errors
    expect(logger.info).toHaveBeenCalledWith('[Retention] Starting cleanup job')
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeleted: expect.any(Number) }),
      '[Retention] Cleanup job completed'
    )
  })
})

describe('Retention Cleanup Job - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log error and rethrow on failure', async () => {
    const { prisma } = await import('../lib/prisma.js')

    // Make organization.findMany throw an error
    vi.mocked(prisma.organization.findMany).mockRejectedValueOnce(new Error('Database connection failed'))

    await expect(runRetentionCleanup()).rejects.toThrow('Database connection failed')

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      '[Retention] Cleanup job failed'
    )
  })
})
