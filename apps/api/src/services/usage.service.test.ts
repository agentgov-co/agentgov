import { describe, it, expect, beforeEach, vi } from 'vitest'

// State object - must be defined before mocks for hoisting
const testState = {
  currentSubscription: { tier: 'FREE_BETA', status: 'ACTIVE' } as { tier: string; status: string } | null,
  currentUsageRecord: { tracesCount: 0 },
  projectsCount: 0,
  membersCount: 0,
  billingEnabled: false,
}

// Mock config
vi.mock('../lib/config.js', () => ({
  config: {
    billing: {
      get enabled() { return testState.billingEnabled },
    },
    get defaultPlan() { return testState.billingEnabled ? 'FREE' : 'FREE_BETA' },
    planDefaults: {
      FREE_BETA: { tracesPerMonth: 20000, projectsMax: 3, membersMax: 5, retentionDays: 15 },
      FREE: { tracesPerMonth: 1000, projectsMax: 1, membersMax: 2, retentionDays: 7 },
      STARTER: { tracesPerMonth: 50000, projectsMax: 5, membersMax: 10, retentionDays: 30 },
      PRO: { tracesPerMonth: 500000, projectsMax: 20, membersMax: 50, retentionDays: 90 },
      ENTERPRISE: { tracesPerMonth: -1, projectsMax: -1, membersMax: -1, retentionDays: 365 },
    },
  },
}))

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    planLimit: {
      findUnique: vi.fn(({ where }: { where: { tier: string } }) => {
        const limits: Record<string, unknown> = {
          FREE_BETA: { tier: 'FREE_BETA', tracesPerMonth: 20000, projectsMax: 3, membersMax: 5, retentionDays: 15 },
          FREE: { tier: 'FREE', tracesPerMonth: 1000, projectsMax: 1, membersMax: 2, retentionDays: 7 },
          STARTER: { tier: 'STARTER', tracesPerMonth: 50000, projectsMax: 5, membersMax: 10, retentionDays: 30 },
          PRO: { tier: 'PRO', tracesPerMonth: 500000, projectsMax: 20, membersMax: 50, retentionDays: 90 },
          ENTERPRISE: { tier: 'ENTERPRISE', tracesPerMonth: -1, projectsMax: -1, membersMax: -1, retentionDays: 365 },
        }
        return Promise.resolve(limits[where.tier] || null)
      }),
    },
    subscription: {
      findUnique: vi.fn(() => Promise.resolve(testState.currentSubscription)),
      create: vi.fn(({ data }: { data: unknown }) => Promise.resolve({ id: 'sub_new', ...data as object })),
    },
    usageRecord: {
      upsert: vi.fn(({ update }: { create: unknown; update: { tracesCount?: { increment?: number } } }) => {
        if (update.tracesCount?.increment) {
          testState.currentUsageRecord.tracesCount += update.tracesCount.increment
        }
        return Promise.resolve({
          ...testState.currentUsageRecord,
          periodStart: new Date(),
          periodEnd: new Date(),
        })
      }),
    },
    project: {
      count: vi.fn(() => Promise.resolve(testState.projectsCount)),
    },
    member: {
      count: vi.fn(() => Promise.resolve(testState.membersCount)),
    },
  },
}))

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Import after mocks
import { usageService } from './usage.service.js'

describe('UsageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    testState.currentSubscription = { tier: 'FREE_BETA', status: 'ACTIVE' }
    testState.currentUsageRecord = { tracesCount: 0 }
    testState.projectsCount =0
    testState.membersCount =0
    testState.billingEnabled = false
  })

  describe('ensureSubscription', () => {
    it('should create subscription if not exists', async () => {
      testState.currentSubscription = null
      const { prisma } = await import('../lib/prisma.js')

      await usageService.ensureSubscription('org_123')

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org_123',
          tier: 'FREE_BETA',
          status: 'ACTIVE',
        },
      })
    })

    it('should not create subscription if exists', async () => {
      testState.currentSubscription = { tier: 'FREE_BETA', status: 'ACTIVE' }
      const { prisma } = await import('../lib/prisma.js')

      await usageService.ensureSubscription('org_123')

      expect(prisma.subscription.create).not.toHaveBeenCalled()
    })

    it('should use FREE plan when billing is enabled', async () => {
      testState.currentSubscription = null
      testState.billingEnabled = true
      const { prisma } = await import('../lib/prisma.js')

      await usageService.ensureSubscription('org_123')

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tier: 'FREE',
        }),
      })
    })
  })

  describe('getCurrentUsage', () => {
    it('should upsert usage record', async () => {
      const { prisma } = await import('../lib/prisma.js')

      const result = await usageService.getCurrentUsage('org_123')

      expect(prisma.usageRecord.upsert).toHaveBeenCalled()
      expect(result).toHaveProperty('tracesCount')
    })
  })

  describe('incrementTraces', () => {
    it('should increment trace count by 1', async () => {
      await usageService.incrementTraces('org_123')

      expect(testState.currentUsageRecord.tracesCount).toBe(1)
    })

    it('should increment trace count by specified amount', async () => {
      await usageService.incrementTraces('org_123', 5)

      expect(testState.currentUsageRecord.tracesCount).toBe(5)
    })

    it('should not throw on error', async () => {
      const { prisma } = await import('../lib/prisma.js')
      vi.mocked(prisma.usageRecord.upsert).mockRejectedValueOnce(new Error('DB error'))

      // Should not throw
      await usageService.incrementTraces('org_123')
    })
  })

  describe('getUsageWithLimits', () => {
    it('should return usage data with limits', async () => {
      testState.currentUsageRecord = { tracesCount: 5000 }
      testState.projectsCount =2
      testState.membersCount =3

      const result = await usageService.getUsageWithLimits('org_123')

      expect(result).toMatchObject({
        tracesCount: 5000,
        projectsCount: 2,
        membersCount: 3,
        tracesLimit: 20000,
        projectsLimit: 3,
        membersLimit: 5,
        retentionDays: 15,
        tier: 'FREE_BETA',
        status: 'ACTIVE',
        billingEnabled: false,
      })
    })

    it('should calculate percentages correctly', async () => {
      testState.currentUsageRecord = { tracesCount: 10000 }
      testState.projectsCount =1
      testState.membersCount =2

      const result = await usageService.getUsageWithLimits('org_123')

      expect(result.tracesPercentage).toBe(50) // 10000/20000 = 50%
      expect(result.projectsPercentage).toBe(33) // 1/3 = 33%
      expect(result.membersPercentage).toBe(40) // 2/5 = 40%
    })

    it('should return 0% for unlimited plans', async () => {
      testState.currentSubscription = { tier: 'ENTERPRISE', status: 'ACTIVE' }
      testState.currentUsageRecord = { tracesCount: 1000000 }

      const result = await usageService.getUsageWithLimits('org_123')

      expect(result.tracesPercentage).toBe(0)
      expect(result.projectsPercentage).toBe(0)
      expect(result.membersPercentage).toBe(0)
    })
  })

  describe('canPerformAction', () => {
    describe('create_trace', () => {
      it('should allow when under limit', async () => {
        testState.currentUsageRecord = { tracesCount: 100 }

        const result = await usageService.canPerformAction('org_123', 'create_trace')

        expect(result.allowed).toBe(true)
      })

      it('should deny when at limit', async () => {
        testState.currentUsageRecord = { tracesCount: 20000 }

        const result = await usageService.canPerformAction('org_123', 'create_trace')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Monthly trace limit reached')
      })

      it('should deny when over limit', async () => {
        testState.currentUsageRecord = { tracesCount: 25000 }

        const result = await usageService.canPerformAction('org_123', 'create_trace')

        expect(result.allowed).toBe(false)
      })

      it('should always allow for unlimited plan', async () => {
        testState.currentSubscription = { tier: 'ENTERPRISE', status: 'ACTIVE' }
        testState.currentUsageRecord = { tracesCount: 10000000 }

        const result = await usageService.canPerformAction('org_123', 'create_trace')

        expect(result.allowed).toBe(true)
      })
    })

    describe('create_project', () => {
      it('should allow when under limit', async () => {
        testState.projectsCount =1

        const result = await usageService.canPerformAction('org_123', 'create_project')

        expect(result.allowed).toBe(true)
      })

      it('should deny when at limit', async () => {
        testState.projectsCount =3 // FREE_BETA limit

        const result = await usageService.canPerformAction('org_123', 'create_project')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Project limit reached')
      })

      it('should always allow for unlimited plan', async () => {
        testState.currentSubscription = { tier: 'ENTERPRISE', status: 'ACTIVE' }
        testState.projectsCount =1000

        const result = await usageService.canPerformAction('org_123', 'create_project')

        expect(result.allowed).toBe(true)
      })
    })

    describe('add_member', () => {
      it('should allow when under limit', async () => {
        testState.membersCount =2

        const result = await usageService.canPerformAction('org_123', 'add_member')

        expect(result.allowed).toBe(true)
      })

      it('should deny when at limit', async () => {
        testState.membersCount =5 // FREE_BETA limit

        const result = await usageService.canPerformAction('org_123', 'add_member')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Team member limit reached')
      })

      it('should always allow for unlimited plan', async () => {
        testState.currentSubscription = { tier: 'ENTERPRISE', status: 'ACTIVE' }
        testState.membersCount =1000

        const result = await usageService.canPerformAction('org_123', 'add_member')

        expect(result.allowed).toBe(true)
      })
    })

    describe('different tiers', () => {
      it('should use FREE limits when billing enabled', async () => {
        testState.billingEnabled = true
        testState.currentSubscription = { tier: 'FREE', status: 'ACTIVE' }
        testState.currentUsageRecord = { tracesCount: 1000 }

        const result = await usageService.canPerformAction('org_123', 'create_trace')

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('1,000 traces')
      })

      it('should use STARTER limits', async () => {
        testState.currentSubscription = { tier: 'STARTER', status: 'ACTIVE' }
        testState.currentUsageRecord = { tracesCount: 40000 }

        const result = await usageService.canPerformAction('org_123', 'create_trace')

        expect(result.allowed).toBe(true)
      })

      it('should use PRO limits', async () => {
        testState.currentSubscription = { tier: 'PRO', status: 'ACTIVE' }
        testState.currentUsageRecord = { tracesCount: 400000 }

        const result = await usageService.canPerformAction('org_123', 'create_trace')

        expect(result.allowed).toBe(true)
      })
    })
  })

  describe('getRetentionDays', () => {
    it('should return retention days for FREE_BETA', async () => {
      testState.currentSubscription = { tier: 'FREE_BETA', status: 'ACTIVE' }

      const result = await usageService.getRetentionDays('org_123')

      expect(result).toBe(15)
    })

    it('should return retention days for STARTER', async () => {
      testState.currentSubscription = { tier: 'STARTER', status: 'ACTIVE' }

      const result = await usageService.getRetentionDays('org_123')

      expect(result).toBe(30)
    })

    it('should return retention days for PRO', async () => {
      testState.currentSubscription = { tier: 'PRO', status: 'ACTIVE' }

      const result = await usageService.getRetentionDays('org_123')

      expect(result).toBe(90)
    })

    it('should return retention days for ENTERPRISE', async () => {
      testState.currentSubscription = { tier: 'ENTERPRISE', status: 'ACTIVE' }

      const result = await usageService.getRetentionDays('org_123')

      expect(result).toBe(365)
    })
  })
})
