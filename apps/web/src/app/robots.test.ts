import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('robots.txt generation', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('should allow root for general crawlers', async () => {
    const { default: robots } = await import('./robots')
    const result = robots()

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const mainRule = rules.find(r => r.userAgent === '*')
    expect(mainRule?.allow).toBe('/')
  })

  it('should disallow /dashboard/, /api/, and /sentry-example-page for general crawlers', async () => {
    const { default: robots } = await import('./robots')
    const result = robots()

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const mainRule = rules.find(r => r.userAgent === '*')
    expect(mainRule?.disallow).toContain('/dashboard/')
    expect(mainRule?.disallow).toContain('/api/')
    expect(mainRule?.disallow).toContain('/sentry-example-page')
  })

  it('should block AI training bots (CCBot, Google-Extended, Bytespider, Diffbot)', async () => {
    const { default: robots } = await import('./robots')
    const result = robots()

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const trainingBots = ['CCBot', 'Google-Extended', 'Bytespider', 'Diffbot', 'FacebookBot', 'omgili']

    for (const bot of trainingBots) {
      const rule = rules.find(r => r.userAgent === bot)
      expect(rule, `Expected blocking rule for ${bot}`).toBeDefined()
      expect(rule?.disallow).toBe('/')
    }
  })

  it('should explicitly allow AI search bots (GPTBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Perplexity-User, anthropic-ai)', async () => {
    const { default: robots } = await import('./robots')
    const result = robots()

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const searchBots = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'anthropic-ai']

    for (const bot of searchBots) {
      const rule = rules.find(r => r.userAgent === bot)
      expect(rule, `Expected allow rule for ${bot}`).toBeDefined()
      expect(rule?.allow).toBe('/')
      expect(rule?.disallow).toContain('/dashboard/')
      expect(rule?.disallow).toContain('/api/')
    }
  })

  it('should include sitemap URL', async () => {
    const { default: robots } = await import('./robots')
    const result = robots()

    expect(result.sitemap).toBe('https://agentgov.co/sitemap.xml')
  })

  it('should use NEXT_PUBLIC_SITE_URL for sitemap when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom.example.com'
    const { default: robots } = await import('./robots')
    const result = robots()

    expect(result.sitemap).toBe('https://custom.example.com/sitemap.xml')
  })
})
