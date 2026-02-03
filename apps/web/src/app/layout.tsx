import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { Providers } from './providers'
import { HydrationFix } from '@/components/hydration-fix'

const inter = Inter({ subsets: ['latin'] })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agentgov.co'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AgentGov - AI Agent Governance Platform',
    template: '%s | AgentGov',
  },
  description: 'Tracing, security, and compliance for AI agents. Monitor your AI agents with real-time observability, enforce policies, and stay compliant with EU AI Act.',
  openGraph: {
    title: 'AgentGov - AI Agent Governance Platform',
    description: 'Tracing, security, and compliance for AI agents',
    url: SITE_URL,
    siteName: 'AgentGov',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentGov - AI Agent Governance Platform',
    description: 'Tracing, security, and compliance for AI agents',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'AgentGov',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Web',
              url: SITE_URL,
              description: 'AI Agent Governance Platform — tracing, security, and EU AI Act compliance for AI agents.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
            }).replace(/</g, '\\u003c'),
          }}
        />
        <HydrationFix nonce={nonce} />
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
