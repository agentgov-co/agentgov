import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Providers } from "./providers";
import { HydrationFix } from "@/components/hydration-fix";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  FAQPageJsonLd,
  WebSiteJsonLd,
} from "@/components/structured-data";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentgov.co";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AgentGov — AI Agent Governance Platform",
    template: "%s | AgentGov",
  },
  description:
    "Monitor, secure, and govern your AI agents with real-time observability and EU AI Act compliance. Free beta with 100K traces/month.",
  keywords: [
    "AI governance",
    "AI observability",
    "EU AI Act",
    "EU AI Act compliance",
    "LLM monitoring",
    "AI compliance",
    "agent tracing",
    "AI risk management",
    "AI agent monitoring",
    "Langfuse alternative",
  ],
  authors: [{ name: "AgentGov" }],
  creator: "AgentGov",
  publisher: "AgentGov",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://agentgov.co",
    siteName: "AgentGov",
    title: "AgentGov — AI Agent Governance Platform",
    description:
      "Monitor, secure, and govern your AI agents with real-time observability and EU AI Act compliance.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentGov — AI Agent Governance Platform",
    description:
      "Monitor, secure, and govern your AI agents with EU AI Act compliance.",
    creator: "@agentgov",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  alternates: {
    canonical: "https://agentgov.co",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationJsonLd />
        <SoftwareApplicationJsonLd />
        <FAQPageJsonLd />
        <WebSiteJsonLd />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <HydrationFix nonce={nonce} />
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
