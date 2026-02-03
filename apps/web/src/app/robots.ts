import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agentgov.co'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Основное правило для всех ботов
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/sentry-example-page'],
      },
      // === TRAINING БОТЫ — БЛОКИРОВАТЬ ===
      // Эти боты собирают данные для обучения AI моделей
      {
        userAgent: 'CCBot',           // Common Crawl datasets
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended', // Gemini training (не Google Search!)
        disallow: '/',
      },
      {
        userAgent: 'Bytespider',      // ByteDance/TikTok AI training
        disallow: '/',
      },
      {
        userAgent: 'Diffbot',         // Web scraping for AI datasets
        disallow: '/',
      },
      {
        userAgent: 'FacebookBot',     // Meta AI training
        disallow: '/',
      },
      {
        userAgent: 'omgili',          // Data mining
        disallow: '/',
      },
      // === SEARCH/BROWSE БОТЫ — ЯВНО РАЗРЕШИТЬ ===
      // Позволяет AI поисковикам цитировать AgentGov в ответах
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
