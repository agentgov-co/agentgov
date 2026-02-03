'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// Dynamic import to avoid SSR issues
const reportToSentry = async (error: Error, componentStack?: string): Promise<void> => {
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, {
      extra: { componentStack },
    })
  } catch {
    console.error('Failed to report to Sentry:', error)
  }
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo)

    // Report error to Sentry
    reportToSentry(error, errorInfo.componentStack ?? undefined)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center">
          <div className="p-3 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Something went wrong</h3>
          <p className="text-black/60 text-sm mb-4 max-w-md">
            An unexpected error occurred. Please try again.
          </p>
          <Button onClick={this.handleReset} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional wrapper for easier usage
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}

// Auth-specific error boundary with custom styling
export function AuthErrorBoundary({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-white rounded-3xl border border-black/10 p-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">
              Something went wrong
            </h1>
            <p className="text-black/60 mb-6">
              We encountered an error. Please try refreshing the page.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
            >
              Refresh page
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// Dashboard-specific error boundary
export function DashboardErrorBoundary({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-white rounded-lg border border-black/10">
          <div className="p-3 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Failed to load content</h3>
          <p className="text-black/60 text-sm mb-4 max-w-md">
            There was an error loading this section. Please try again.
          </p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </Button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
