import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { AuthErrorBoundary } from '@/components/error-boundary'

export default function AuthLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div
      className="min-h-screen flex flex-col bg-neutral-50"
      style={{
        backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* Header */}
      <header className="h-16 flex items-center justify-center border-b border-black/10 bg-white">
        <Link href="/">
          <Logo size="md" />
        </Link>
      </header>

      {/* Content */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <AuthErrorBoundary>
            {children}
          </AuthErrorBoundary>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-black/40">
        <p>AI Agent Governance Platform</p>
      </footer>
    </div>
  )
}
