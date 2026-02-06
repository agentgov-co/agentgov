import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";
import { buildSecurityHeaders } from "./src/lib/security-headers";
import { validateEnv } from "./src/lib/env-validation";

// Build-time environment validation — fails fast before deployment
if (process.env.NODE_ENV === 'production') {
  const result = validateEnv(process.env as Record<string, string | undefined>);
  if (!result.valid) {
    throw new Error(
      `[agentgov] Build aborted — environment validation failed:\n${result.errors.map(e => `  - ${e}`).join('\n')}`
    );
  }
}

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Performance optimizations
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression

  // Security headers
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    // Base CSP for static pages (pre-rendered at build time, no nonce available).
    // Middleware overwrites this with a stricter nonce-based CSP for SSR routes.
    const staticCsp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live https://*.sentry.io https://static.cloudflareinsights.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `connect-src 'self' ${apiUrl} ws: wss: https://*.sentry.io https://va.vercel-scripts.com https://vercel.live https://cloudflareinsights.com`,
      "font-src 'self'",
      "frame-src 'self' https://vercel.live",
      "frame-ancestors 'none'",
    ].join('; ')

    return [{
      source: '/:path*',
      headers: [
        ...buildSecurityHeaders(),
        { key: 'Content-Security-Policy', value: staticCsp },
      ],
    }]
  },

  // Optimize package imports for better tree-shaking
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // Upload source maps to Sentry
  org: "agentgov",
  project: "javascript-nextjs",
  // Disable source map upload in development
  disableServerWebpackPlugin: process.env.NODE_ENV !== "production",
  disableClientWebpackPlugin: process.env.NODE_ENV !== "production",
  // Tree-shake Sentry debug logger code from production bundle
  disableLogger: true,
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), sentryWebpackPluginOptions);
