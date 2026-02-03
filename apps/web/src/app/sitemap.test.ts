import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('sitemap.xml generation', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('should return all public pages', async () => {
    const { default: sitemap } = await import('./sitemap')
    const result = sitemap()

    const urls = result.map(entry => entry.url)
    expect(urls).toContain('https://agentgov.co')
    expect(urls).toContain('https://agentgov.co/login')
    expect(urls).toContain('https://agentgov.co/register')
    expect(urls).toContain('https://agentgov.co/forgot-password')
  })

  it('should not include dashboard or api routes', async () => {
    const { default: sitemap } = await import('./sitemap')
    const result = sitemap()

    const urls = result.map(entry => entry.url)
    for (const url of urls) {
      expect(url).not.toContain('/dashboard')
      expect(url).not.toContain('/api/')
    }
  })

  it('should set homepage as highest priority', async () => {
    const { default: sitemap } = await import('./sitemap')
    const result = sitemap()

    const home = result.find(entry => entry.url === 'https://agentgov.co')
    expect(home?.priority).toBe(1)
  })

  it('should set lastModified as Date on all entries', async () => {
    const { default: sitemap } = await import('./sitemap')
    const result = sitemap()

    for (const entry of result) {
      expect(entry.lastModified).toBeInstanceOf(Date)
    }
  })

  it('should use NEXT_PUBLIC_SITE_URL when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom.example.com'
    const { default: sitemap } = await import('./sitemap')
    const result = sitemap()

    for (const entry of result) {
      expect(entry.url).toMatch(/^https:\/\/custom\.example\.com/)
    }
  })

  it('should not include sentry-example-page', async () => {
    const { default: sitemap } = await import('./sitemap')
    const result = sitemap()

    const urls = result.map(entry => entry.url)
    for (const url of urls) {
      expect(url).not.toContain('sentry')
    }
  })
})
