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

    const generalRule = result.rules
    const mainRule = Array.isArray(generalRule)
      ? generalRule.find(r => r.userAgent === '*')
      : generalRule
    expect(mainRule?.allow).toBe('/')
  })

  it('should disallow /dashboard/ and /api/ for general crawlers', async () => {
    const { default: robots } = await import('./robots')
    const result = robots()

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const mainRule = rules.find(r => r.userAgent === '*')
    expect(mainRule?.disallow).toContain('/dashboard/')
    expect(mainRule?.disallow).toContain('/api/')
  })

  it('should disallow /sentry-example-page for general crawlers', async () => {
    const { default: robots } = await import('./robots')
    const result = robots()

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const mainRule = rules.find(r => r.userAgent === '*')
    expect(mainRule?.disallow).toContain('/sentry-example-page')
  })

  it('should block AI crawlers (GPTBot, CCBot, Google-Extended)', async () => {
    const { default: robots } = await import('./robots')
    const result = robots()

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const blockedBots = ['GPTBot', 'CCBot', 'Google-Extended']

    for (const bot of blockedBots) {
      const rule = rules.find(r => r.userAgent === bot)
      expect(rule, `Expected rule for ${bot}`).toBeDefined()
      expect(rule?.disallow).toBe('/')
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
