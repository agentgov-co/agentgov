import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TracesTable } from './traces-table'

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

// Import the mocked module to control its return value
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
      totalDuration: null,
    },
    {
      id: 'trace-3',
      name: null,
      status: 'FAILED',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      endedAt: new Date(Date.now() - 3500000).toISOString(),
      totalTokens: null,
      totalCost: null,
      totalDuration: 100000,
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

describe('TracesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton when loading', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTraces>)

    render(
      <TracesTable projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    // Should show loading skeletons
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders empty state when no traces', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: { data: [], pagination: { total: 0, page: 1, limit: 10 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesTable projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText(/No traces found/i)).toBeInTheDocument()
  })

  it('renders traces table with data', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesTable projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    // Check table headers
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Tokens')).toBeInTheDocument()
    expect(screen.getByText('Cost')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Started')).toBeInTheDocument()

    // Check trace data
    expect(screen.getByText('Test Trace 1')).toBeInTheDocument()
    expect(screen.getByText('Test Trace 2')).toBeInTheDocument()
    expect(screen.getByText(/Trace trace-3/)).toBeInTheDocument()
  })

  it('displays token count correctly', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesTable projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('displays cost correctly', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesTable projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('$0.0023')).toBeInTheDocument()
  })

  it('displays duration correctly', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesTable projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('2.50s')).toBeInTheDocument()
    expect(screen.getByText('100.00s')).toBeInTheDocument()
  })

  it('highlights specified traces', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    const highlightIds = new Set(['trace-1'])

    const { container } = render(
      <TracesTable projectId="project-1" highlightIds={highlightIds} />,
      { wrapper: createWrapper() }
    )

    // Check that the highlighted trace has the highlight class
    const rows = container.querySelectorAll('tr')
    const highlightedRow = Array.from(rows).find(row =>
      row.textContent?.includes('Test Trace 1')
    )
    expect(highlightedRow?.className).toContain('bg-green-50')
  })

  it('shows pagination info', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesTable projectId="project-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText(/Showing 3 of 3 traces/i)).toBeInTheDocument()
  })

  it('passes filters to useTraces hook', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesTable
        projectId="project-1"
        statusFilter="completed"
        searchQuery="test"
      />,
      { wrapper: createWrapper() }
    )

    expect(useTraces).toHaveBeenCalledWith({
      projectId: 'project-1',
      limit: 50,
      status: 'COMPLETED',
      search: 'test',
    })
  })

  it('passes undefined status when filter is "all"', () => {
    vi.mocked(useTraces).mockReturnValue({
      data: mockTraces,
      isLoading: false,
    } as unknown as ReturnType<typeof useTraces>)

    render(
      <TracesTable projectId="project-1" statusFilter="all" />,
      { wrapper: createWrapper() }
    )

    expect(useTraces).toHaveBeenCalledWith({
      projectId: 'project-1',
      limit: 50,
      status: undefined,
      search: undefined,
    })
  })
})
