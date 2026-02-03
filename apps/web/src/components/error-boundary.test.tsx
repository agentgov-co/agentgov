import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, AuthErrorBoundary, DashboardErrorBoundary } from './error-boundary'

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }): React.JSX.Element {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Suppress console.error for cleaner test output
const originalError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalError
})

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })

  it('calls onReset when try again button is clicked', () => {
    const onReset = vi.fn()

    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowError />
      </ErrorBoundary>
    )

    fireEvent.click(screen.getByText('Try again'))
    expect(onReset).toHaveBeenCalled()
  })

  it('resets error state and re-renders when try again is clicked', () => {
    // Create a controllable throwing component
    let shouldThrow = true
    function ControllableThrow(): React.JSX.Element {
      if (shouldThrow) {
        throw new Error('Test error message')
      }
      return <div>No error</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ControllableThrow />
      </ErrorBoundary>
    )

    // Should show error UI
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Stop throwing before clicking try again
    shouldThrow = false

    // Click try again and rerender
    fireEvent.click(screen.getByText('Try again'))

    // Rerender to trigger the non-throwing state
    rerender(
      <ErrorBoundary>
        <ControllableThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })
})

describe('AuthErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <AuthErrorBoundary>
        <div>Auth content</div>
      </AuthErrorBoundary>
    )

    expect(screen.getByText('Auth content')).toBeInTheDocument()
  })

  it('renders auth-specific error UI when child throws', () => {
    render(
      <AuthErrorBoundary>
        <ThrowError />
      </AuthErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('We encountered an error. Please try refreshing the page.')).toBeInTheDocument()
    expect(screen.getByText('Refresh page')).toBeInTheDocument()
  })
})

describe('DashboardErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <DashboardErrorBoundary>
        <div>Dashboard content</div>
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })

  it('renders dashboard-specific error UI when child throws', () => {
    render(
      <DashboardErrorBoundary>
        <ThrowError />
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Failed to load content')).toBeInTheDocument()
    expect(screen.getByText('There was an error loading this section. Please try again.')).toBeInTheDocument()
    expect(screen.getByText('Reload')).toBeInTheDocument()
  })
})
