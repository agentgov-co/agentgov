import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agentgov.co'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/sentry-example-page'],
      },
      // === TRAINING БОТЫ — БЛОКИРОВАТЬ ===
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
      {
        userAgent: 'Bytespider',
        disallow: '/',
      },
      {
        userAgent: 'Diffbot',
        disallow: '/',
      },
      {
        userAgent: 'FacebookBot',
        disallow: '/',
      },
      {
        userAgent: 'omgili',
        disallow: '/',
      },
      // === SEARCH/BROWSE БОТЫ — ЯВНО РАЗРЕШИТЬ ===
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
      {
        userAgent: 'Claude-SearchBot',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
      {
        userAgent: 'Perplexity-User',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
