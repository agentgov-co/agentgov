import { PrismaClient, TraceStatus, SpanType, SpanStatus, PlanTier, SubscriptionStatus } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcrypt'

const BCRYPT_ROUNDS = 12 // Must match auth.ts configuration

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

function generateDevApiKey(): { key: string; hash: string } {
  // Generate a random API key for development
  const suffix = randomBytes(16).toString('hex')
  const key = `ag_test_${suffix}`
  const hash = hashApiKey(key)
  return { key, hash }
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agentgov'
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // User
  const userId = 'gGs8Mn8vgE5Wrksorx4BHBHsGrHhYyUN'
  const email = 'dev@dev.com'
  const password = await hashPassword('dev123')

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email,
      name: 'Dev User',
      emailVerified: true,
    },
  })
  console.log(`✓ User: ${user.email}`)

  // Account (password auth)
  await prisma.account.upsert({
    where: { id: `${userId}-credential` },
    update: { password },
    create: {
      id: `${userId}-credential`,
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password,
    },
  })
  console.log('✓ Account created')

  // Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'dev-org' },
    update: {},
    create: {
      id: 'org_dev_001',
      name: 'Dev Organization',
      slug: 'dev-org',
      metadata: { plan: 'free' },
    },
  })
  console.log(`✓ Organization: ${org.name}`)

  // Member (link user to org as owner)
  await prisma.member.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: {},
    create: {
      organizationId: org.id,
      userId: user.id,
      role: 'owner',
    },
  })
  console.log('✓ Member linked')

  // Plan Limits
  const planLimits = [
    {
      tier: PlanTier.FREE_BETA,
      tracesPerMonth: 100000,
      projectsMax: 10,
      membersMax: 5,
      retentionDays: 30,
      features: {
        support: 'community',
        aiSystemsMax: 10,
        riskClassification: true,
        docGeneration: true,
        friaReports: true,
        incidentTracking: true,
        auditExport: true,
      },
      stripePriceId: null,
    },
    {
      tier: PlanTier.FREE,
      tracesPerMonth: 1000,
      projectsMax: 1,
      membersMax: 2,
      retentionDays: 7,
      features: { support: 'community' },
      stripePriceId: null,
    },
    {
      tier: PlanTier.STARTER,
      tracesPerMonth: 50000,
      projectsMax: 5,
      membersMax: 10,
      retentionDays: 30,
      features: { support: 'email', webhooks: true },
      stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null,
    },
    {
      tier: PlanTier.PRO,
      tracesPerMonth: 500000,
      projectsMax: 20,
      membersMax: 50,
      retentionDays: 90,
      features: { support: 'priority', webhooks: true, sso: true },
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
    },
    {
      tier: PlanTier.ENTERPRISE,
      tracesPerMonth: -1, // unlimited
      projectsMax: -1,
      membersMax: -1,
      retentionDays: 365,
      features: { support: 'dedicated', webhooks: true, sso: true, audit: true },
      stripePriceId: null, // Custom pricing
    },
  ]

  for (const limit of planLimits) {
    await prisma.planLimit.upsert({
      where: { tier: limit.tier },
      update: {
        tracesPerMonth: limit.tracesPerMonth,
        projectsMax: limit.projectsMax,
        membersMax: limit.membersMax,
        retentionDays: limit.retentionDays,
        features: limit.features,
        stripePriceId: limit.stripePriceId,
      },
      create: limit,
    })
  }
  console.log('✓ Plan limits created')

  // Subscription for dev org
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      tier: PlanTier.FREE_BETA,
      status: SubscriptionStatus.ACTIVE,
    },
  })
  console.log('✓ Subscription created')

  // Projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { id: 'proj_chatbot' },
      update: {},
      create: {
        id: 'proj_chatbot',
        name: 'Customer Support Bot',
        description: 'AI-powered customer support chatbot',
        organizationId: org.id,
      },
    }),
    prisma.project.upsert({
      where: { id: 'proj_research' },
      update: {},
      create: {
        id: 'proj_research',
        name: 'Research Agent',
        description: 'Autonomous research assistant',
        organizationId: org.id,
      },
    }),
    prisma.project.upsert({
      where: { id: 'proj_coder' },
      update: {},
      create: {
        id: 'proj_coder',
        name: 'Code Assistant',
        description: 'AI coding assistant with tool use',
        organizationId: org.id,
      },
    }),
  ])
  console.log(`✓ Projects: ${projects.map(p => p.name).join(', ')}`)

  // API Key for SDK testing - generate fresh key each seed
  const { key: devApiKey, hash: apiKeyHash } = generateDevApiKey()
  await prisma.apiKey.upsert({
    where: { id: 'apikey_dev_001' },
    update: { keyHash: apiKeyHash }, // Update hash if key changed
    create: {
      id: 'apikey_dev_001',
      name: 'Development Key',
      keyHash: apiKeyHash,
      keyPrefix: 'ag_test_',
      userId: user.id,
      organizationId: org.id,
      projectId: projects[0].id,
      permissions: ['traces:write', 'traces:read', 'projects:read'],
      rateLimit: 10000,
    },
  })
  console.log('✓ API Key created')

  // Create realistic sample traces and spans
  const now = new Date()

  // Helper to create realistic agent execution traces
  async function createRealisticTrace(
    projectId: string,
    name: string,
    hoursAgo: number,
    status: TraceStatus,
    scenario: 'chat' | 'research' | 'code' | 'support'
  ) {
    const startedAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)

    // Different scenarios have different span patterns
    const scenarios = {
      chat: {
        totalDuration: 3500 + Math.random() * 2000, // 3.5-5.5s
        spans: [
          { type: SpanType.AGENT_STEP, name: 'parse_user_intent', duration: 150, offset: 0 },
          { type: SpanType.RETRIEVAL, name: 'search_knowledge_base', duration: 450, offset: 150 },
          { type: SpanType.LLM_CALL, name: 'generate_response', duration: 2200, offset: 600, model: 'gpt-4-turbo', tokens: [1200, 350], cost: 0.052 },
          { type: SpanType.TOOL_CALL, name: 'format_response', duration: 80, offset: 2800, tool: 'markdown_formatter' },
        ],
      },
      research: {
        totalDuration: 25000 + Math.random() * 10000, // 25-35s
        spans: [
          { type: SpanType.AGENT_STEP, name: 'plan_research', duration: 800, offset: 0 },
          { type: SpanType.LLM_CALL, name: 'analyze_query', duration: 1500, offset: 800, model: 'gpt-4-turbo', tokens: [500, 200], cost: 0.018 },
          { type: SpanType.TOOL_CALL, name: 'web_search', duration: 2500, offset: 2300, tool: 'tavily_search', children: [
            { type: SpanType.RETRIEVAL, name: 'fetch_url_1', duration: 800, offset: 0 },
            { type: SpanType.RETRIEVAL, name: 'fetch_url_2', duration: 650, offset: 100 },
            { type: SpanType.RETRIEVAL, name: 'fetch_url_3', duration: 900, offset: 200 },
          ]},
          { type: SpanType.EMBEDDING, name: 'embed_documents', duration: 1200, offset: 4800 },
          { type: SpanType.LLM_CALL, name: 'synthesize_findings', duration: 8500, offset: 6000, model: 'gpt-4-turbo', tokens: [4500, 1800], cost: 0.178 },
          { type: SpanType.LLM_CALL, name: 'generate_citations', duration: 2200, offset: 14500, model: 'gpt-3.5-turbo', tokens: [800, 400], cost: 0.003 },
        ],
      },
      code: {
        totalDuration: 12000 + Math.random() * 5000, // 12-17s
        spans: [
          { type: SpanType.AGENT_STEP, name: 'understand_request', duration: 400, offset: 0 },
          { type: SpanType.RETRIEVAL, name: 'search_codebase', duration: 1800, offset: 400, children: [
            { type: SpanType.TOOL_CALL, name: 'grep_files', duration: 600, offset: 0, tool: 'ripgrep' },
            { type: SpanType.TOOL_CALL, name: 'read_file', duration: 150, offset: 650, tool: 'file_reader' },
            { type: SpanType.TOOL_CALL, name: 'read_file', duration: 120, offset: 850, tool: 'file_reader' },
          ]},
          { type: SpanType.LLM_CALL, name: 'analyze_code', duration: 3500, offset: 2200, model: 'claude-3-opus', tokens: [3200, 1500], cost: 0.142 },
          { type: SpanType.TOOL_CALL, name: 'write_code', duration: 2800, offset: 5700, tool: 'code_writer', children: [
            { type: SpanType.TOOL_CALL, name: 'edit_file', duration: 180, offset: 0, tool: 'file_editor' },
            { type: SpanType.TOOL_CALL, name: 'run_tests', duration: 2400, offset: 200, tool: 'pytest' },
          ]},
          { type: SpanType.LLM_CALL, name: 'explain_changes', duration: 1800, offset: 8500, model: 'gpt-4-turbo', tokens: [600, 450], cost: 0.032 },
        ],
      },
      support: {
        totalDuration: 8000 + Math.random() * 4000, // 8-12s
        spans: [
          { type: SpanType.AGENT_STEP, name: 'classify_ticket', duration: 300, offset: 0 },
          { type: SpanType.LLM_CALL, name: 'extract_intent', duration: 900, offset: 300, model: 'gpt-3.5-turbo', tokens: [400, 150], cost: 0.002 },
          { type: SpanType.RETRIEVAL, name: 'search_faq', duration: 600, offset: 1200 },
          { type: SpanType.RETRIEVAL, name: 'search_tickets', duration: 750, offset: 1200 },
          { type: SpanType.LLM_CALL, name: 'generate_response', duration: 2800, offset: 1950, model: 'gpt-4-turbo', tokens: [1800, 600], cost: 0.068 },
          { type: SpanType.TOOL_CALL, name: 'send_email', duration: 450, offset: 4750, tool: 'email_sender' },
        ],
      },
    }

    const config = scenarios[scenario]
    const totalDuration = Math.round(config.totalDuration)
    const endedAt = status === TraceStatus.RUNNING ? null : new Date(startedAt.getTime() + totalDuration)

    // Calculate totals from spans
    let totalCost = 0
    let totalTokens = 0
    config.spans.forEach(s => {
      if (s.cost) totalCost += s.cost
      if (s.tokens) totalTokens += s.tokens[0] + s.tokens[1]
    })

    const trace = await prisma.trace.create({
      data: {
        projectId,
        name,
        status,
        startedAt,
        endedAt,
        input: {
          message: `User request for ${name.toLowerCase()}`,
          context: { sessionId: `sess_${Math.random().toString(36).slice(2, 10)}`, userId: 'user_123' },
        },
        output: status === TraceStatus.COMPLETED ? {
          response: `Successfully completed ${name.toLowerCase()}`,
          metadata: { confidence: 0.95 },
        } : null,
        metadata: { environment: 'development', version: '1.2.0', scenario },
        totalCost: status === TraceStatus.RUNNING ? null : totalCost,
        totalTokens: status === TraceStatus.RUNNING ? null : totalTokens,
        totalDuration: status === TraceStatus.RUNNING ? null : totalDuration,
      },
    })

    // Create spans with hierarchy
    interface SpanConfig {
      type: SpanType
      name: string
      duration: number
      offset: number
      model?: string
      tokens?: [number, number]
      cost?: number
      tool?: string
      children?: SpanConfig[]
    }

    async function createSpan(spanConfig: SpanConfig, parentId: string | null, baseTime: number): Promise<void> {
      const spanStarted = new Date(baseTime + spanConfig.offset)
      const isLastAndRunning = status === TraceStatus.RUNNING &&
        spanConfig === config.spans[config.spans.length - 1] &&
        !spanConfig.children

      const spanStatus = isLastAndRunning
        ? SpanStatus.RUNNING
        : status === TraceStatus.FAILED && spanConfig === config.spans[config.spans.length - 1]
          ? SpanStatus.FAILED
          : SpanStatus.COMPLETED

      const span = await prisma.span.create({
        data: {
          traceId: trace.id,
          parentId,
          name: spanConfig.name,
          type: spanConfig.type,
          status: spanStatus,
          startedAt: spanStarted,
          endedAt: spanStatus === SpanStatus.RUNNING ? null : new Date(spanStarted.getTime() + spanConfig.duration),
          duration: spanStatus === SpanStatus.RUNNING ? null : spanConfig.duration,
          input: spanConfig.type === SpanType.LLM_CALL
            ? { messages: [{ role: 'user', content: `Request for ${spanConfig.name}` }] }
            : spanConfig.type === SpanType.TOOL_CALL
              ? { tool: spanConfig.tool, args: { query: 'example' } }
              : { query: spanConfig.name },
          output: spanStatus === SpanStatus.COMPLETED
            ? { result: `Completed ${spanConfig.name}` }
            : null,
          error: spanStatus === SpanStatus.FAILED ? 'Error: Operation timed out after 30s' : null,
          model: spanConfig.model || null,
          promptTokens: spanConfig.tokens?.[0] || null,
          outputTokens: spanConfig.tokens?.[1] || null,
          cost: spanConfig.cost || null,
          toolName: spanConfig.tool || null,
          toolInput: spanConfig.tool ? { action: spanConfig.name } : null,
          toolOutput: spanConfig.tool && spanStatus === SpanStatus.COMPLETED ? { success: true } : null,
        },
      })

      // Create children if any
      if (spanConfig.children) {
        for (const child of spanConfig.children) {
          await createSpan(child, span.id, spanStarted.getTime())
        }
      }
    }

    for (const spanConfig of config.spans) {
      await createSpan(spanConfig, null, startedAt.getTime())
    }

    return trace
  }

  // Create diverse traces
  const traces = await Promise.all([
    // Running trace
    createRealisticTrace(projects[0].id, 'Customer inquiry about refund', 0.1, TraceStatus.RUNNING, 'support'),

    // Recent completed traces
    createRealisticTrace(projects[1].id, 'Research: AI governance trends 2025', 0.5, TraceStatus.COMPLETED, 'research'),
    createRealisticTrace(projects[2].id, 'Refactor authentication module', 1, TraceStatus.COMPLETED, 'code'),
    createRealisticTrace(projects[0].id, 'Product recommendation chat', 2, TraceStatus.COMPLETED, 'chat'),

    // Failed trace
    createRealisticTrace(projects[1].id, 'Deep analysis of competitor products', 3, TraceStatus.FAILED, 'research'),

    // Older traces
    createRealisticTrace(projects[2].id, 'Fix bug in payment processing', 5, TraceStatus.COMPLETED, 'code'),
    createRealisticTrace(projects[0].id, 'Technical support: API integration', 8, TraceStatus.COMPLETED, 'support'),
    createRealisticTrace(projects[1].id, 'Market research summary', 12, TraceStatus.COMPLETED, 'research'),
    createRealisticTrace(projects[0].id, 'General inquiry handling', 24, TraceStatus.COMPLETED, 'chat'),
    createRealisticTrace(projects[2].id, 'Code review for new feature', 48, TraceStatus.COMPLETED, 'code'),
  ])
  console.log(`✓ Traces: ${traces.length} with realistic spans`)

  // Audit logs
  await prisma.auditLog.createMany({
    data: [
      { userId: user.id, organizationId: org.id, action: 'user.login', ipAddress: '127.0.0.1' },
      { userId: user.id, organizationId: org.id, action: 'api_key.created', resourceType: 'api_key', resourceId: 'apikey_dev_001' },
      { userId: user.id, organizationId: org.id, action: 'project.created', resourceType: 'project', resourceId: projects[0].id },
    ],
  })
  console.log('✓ Audit logs created')

  console.log('\n✅ Seed completed!')
  console.log('\n📋 Development credentials:')
  console.log('   Email: dev@dev.com')
  console.log('   Password: (set in seed, check source for dev password)')
  console.log('\n🔑 API Key for SDK testing:')
  console.log(`   ${devApiKey}`)
  console.log('\n⚠️  Save this API key - it will change on next seed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
