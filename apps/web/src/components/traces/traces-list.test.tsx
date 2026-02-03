import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TracesList } from './traces-list'

// Mock the hooks
vi.mock('@/hooks/use-traces', () => ({
  useTraces: vi.fn(),
  useDeleteTrace: vi.fn(() => ({
    mutate: vi.fn(),
  })),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { useTraces } from '@/hooks/use-traces'

const mockTraces = {
  data: [
    {
      id: 'trace-1',
      name: 'Test Trace 1',
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      totalTokens: 1500,
      totalCost: 0.0023,
      totalDuration: 2500,
    },
    {
      id: 'trace-2',
      name: 'Test Trace 2',
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      totalTokens: 500,
      totalCost: null,
      totalDuration: 850,
    },
    {
      id: 'trace-3',
      name: null,
      status: 'FAILED',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      endedAt: new Date(Date.now() - 3500000).toISOString(),
      totalTokens: null,
      totalCost: null,
      totalDuration: null,
    },
  ],
  pagination: {
    total: 3,
    page: 1,
    limit: 10,
  },
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('TracesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton when loading', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTraces>)

    const { container } = render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    // Should show loading skeletons
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders empty state when no traces', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: { data: [], pagination: { total: 0, page: 1, limit: 10 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText(/No traces found/i)).toBeInTheDocument()
  })

  it('renders traces cards with data', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    // Check trace names are displayed
    expect(screen.getByText('Test Trace 1')).toBeInTheDocument()
    expect(screen.getByText('Test Trace 2')).toBeInTheDocument()
    expect(screen.getByText(/Trace trace-3/)).toBeInTheDocument()
  })

  it('displays duration in seconds when >= 1000ms', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('2.5s')).toBeInTheDocument()
  })

  it('displays duration in ms when < 1000ms', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('850ms')).toBeInTheDocument()
  })

  it('displays token count when available', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('displays cost when available', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('0.0023')).toBeInTheDocument()
  })

  it('highlights specified traces', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    const highlightIds = new Set(['trace-1'])

    const { container } = render(
      <TracesList projectId="project-1" highlightIds={highlightIds} />,
      { wrapper: createWrapper() }
    )

    // Check that the highlighted trace has the highlight class
    const cards = container.querySelectorAll('.bg-green-50\\/80')
    expect(cards.length).toBe(1)
  })

  it('has trace options button', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    // Should have options buttons
    const optionsButtons = screen.getAllByRole('button', { name: /Trace options/i })
    expect(optionsButtons.length).toBeGreaterThan(0)
  })

  it('has links to trace details', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    // Should have links to trace details
    const links = screen.getAllByRole('link')
    expect(links.some(link => link.getAttribute('href')?.includes('/dashboard/traces/'))).toBe(true)
  })

  it('passes filters to useTraces hook', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesList
        projectId="project-1"
        statusFilter="running"
        searchQuery="test"
      />,
      { wrapper: createWrapper() }
    )

    expect(useTraces).toHaveBeenCalledWith({
      projectId: 'project-1',
      limit: 50,
      status: 'RUNNING',
      search: 'test',
    })
  })

  it('renders in grid layout', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    const { container } = render(
      <TracesList projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
    expect(grid?.className).toContain('grid-cols-1')
  })
})
