import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpanTree } from './span-tree'
import type { Span } from '@/lib/api'

const mockSpans: Span[] = [
  {
    id: 'span-1',
    traceId: 'trace-1',
    name: 'Root LLM Call',
    type: 'LLM_CALL',
    status: 'COMPLETED',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    parentId: null,
    duration: 1500,
    model: 'gpt-4',
    cost: 0.0045,
    promptTokens: 100,
    outputTokens: 50,
    input: { prompt: 'Hello' },
    output: { response: 'Hi there!' },
    error: null,
    toolName: null,
  },
  {
    id: 'span-2',
    traceId: 'trace-1',
    name: 'Tool: Search',
    type: 'TOOL_CALL',
    status: 'COMPLETED',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    parentId: 'span-1',
    duration: 500,
    model: null,
    cost: null,
    promptTokens: null,
    outputTokens: null,
    input: { query: 'test' },
    output: { results: [] },
    error: null,
    toolName: 'search',
  },
  {
    id: 'span-3',
    traceId: 'trace-1',
    name: 'Agent Step',
    type: 'AGENT_STEP',
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    endedAt: null,
    parentId: null,
    duration: 200,
    model: null,
    cost: null,
    promptTokens: null,
    outputTokens: null,
    input: null,
    output: null,
    error: null,
    toolName: null,
  },
  {
    id: 'span-4',
    traceId: 'trace-1',
    name: 'Failed Call',
    type: 'CUSTOM',
    status: 'FAILED',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    parentId: 'span-3',
    duration: 100,
    model: null,
    cost: null,
    promptTokens: null,
    outputTokens: null,
    input: null,
    output: null,
    error: 'Something went wrong',
    toolName: null,
  },
]

describe('SpanTree', () => {
  it('renders empty state when no spans', () => {
    render(<SpanTree spans={[]} />)

    expect(screen.getByText('No spans')).toBeInTheDocument()
  })

  it('renders root spans', () => {
    render(<SpanTree spans={mockSpans} />)

    expect(screen.getByText('Root LLM Call')).toBeInTheDocument()
    expect(screen.getByText('Agent Step')).toBeInTheDocument()
  })

  it('renders nested spans', () => {
    render(<SpanTree spans={mockSpans} />)

    expect(screen.getByText('Tool: Search')).toBeInTheDocument()
    expect(screen.getByText('Failed Call')).toBeInTheDocument()
  })

  it('displays span type badges', () => {
    render(<SpanTree spans={mockSpans} />)

    expect(screen.getByText('LLM')).toBeInTheDocument()
    expect(screen.getByText('Tool')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('displays span status', () => {
    render(<SpanTree spans={mockSpans} />)

    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('displays model name when present', () => {
    render(<SpanTree spans={mockSpans} />)

    expect(screen.getByText('gpt-4')).toBeInTheDocument()
  })

  it('displays duration in seconds when >= 1000ms', () => {
    render(<SpanTree spans={mockSpans} />)

    expect(screen.getByText('1.50s')).toBeInTheDocument()
  })

  it('displays duration in ms when < 1000ms', () => {
    render(<SpanTree spans={mockSpans} />)

    expect(screen.getByText('500ms')).toBeInTheDocument()
  })

  it('displays cost when present', () => {
    render(<SpanTree spans={mockSpans} />)

    expect(screen.getByText('$0.0045')).toBeInTheDocument()
  })

  it('expands/collapses child spans when chevron is clicked', () => {
    render(<SpanTree spans={mockSpans} />)

    // Initially children should be visible
    expect(screen.getByText('Tool: Search')).toBeInTheDocument()

    // Find and click the collapse button for the first root span
    const collapseButton = screen.getAllByRole('button')[0]
    fireEvent.click(collapseButton)

    // Child should be hidden
    expect(screen.queryByText('Tool: Search')).not.toBeInTheDocument()

    // Click again to expand
    fireEvent.click(collapseButton)

    // Child should be visible again
    expect(screen.getByText('Tool: Search')).toBeInTheDocument()
  })

  it('shows details panel when span row is clicked', () => {
    render(<SpanTree spans={mockSpans} />)

    // Click on the first span row
    fireEvent.click(screen.getByText('Root LLM Call'))

    // Details should show
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Tokens')).toBeInTheDocument()
    expect(screen.getByText('Input')).toBeInTheDocument()
    expect(screen.getByText('Output')).toBeInTheDocument()
  })

  it('displays token info in details panel', () => {
    render(<SpanTree spans={mockSpans} />)

    // Click to show details
    fireEvent.click(screen.getByText('Root LLM Call'))

    // Should show "Tokens" label
    expect(screen.getByText('Tokens')).toBeInTheDocument()
  })

  it('displays error in details panel for failed spans', () => {
    render(<SpanTree spans={mockSpans} />)

    // Click on the failed span
    fireEvent.click(screen.getByText('Failed Call'))

    // Error message should be displayed
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('displays input/output JSON in details panel', () => {
    render(<SpanTree spans={mockSpans} />)

    // Click to show details
    fireEvent.click(screen.getByText('Root LLM Call'))

    // Should show formatted JSON
    expect(screen.getByText(/"prompt": "Hello"/)).toBeInTheDocument()
    expect(screen.getByText(/"response": "Hi there!"/)).toBeInTheDocument()
  })

  it('toggles details panel on click', () => {
    render(<SpanTree spans={mockSpans} />)

    // Click to show details
    fireEvent.click(screen.getByText('Root LLM Call'))
    expect(screen.getByText('Input')).toBeInTheDocument()

    // Click again to hide
    fireEvent.click(screen.getByText('Root LLM Call'))
    expect(screen.queryByText('Input')).not.toBeInTheDocument()
  })

  it('renders retrieval span type', () => {
    const spansWithRetrieval: Span[] = [
      {
        id: 'span-r',
        traceId: 'trace-1',
        name: 'DB Retrieval',
        type: 'RETRIEVAL',
        status: 'COMPLETED',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        parentId: null,
        duration: 100,
        model: null,
        cost: null,
        promptTokens: null,
        outputTokens: null,
        input: null,
        output: null,
        error: null,
        toolName: null,
      },
    ]

    render(<SpanTree spans={spansWithRetrieval} />)

    // Type label should be shown
    expect(screen.getByText('DB Retrieval')).toBeInTheDocument()
  })

  it('renders embedding span type', () => {
    const spansWithEmbedding: Span[] = [
      {
        id: 'span-e',
        traceId: 'trace-1',
        name: 'Embedding',
        type: 'EMBEDDING',
        status: 'COMPLETED',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        parentId: null,
        duration: 50,
        model: null,
        cost: null,
        promptTokens: null,
        outputTokens: null,
        input: null,
        output: null,
        error: null,
        toolName: null,
      },
    ]

    render(<SpanTree spans={spansWithEmbedding} />)

    expect(screen.getByText('Embed')).toBeInTheDocument()
  })

  it('handles deeply nested spans', () => {
    const deepSpans: Span[] = [
      {
        id: 'level-0',
        traceId: 'trace-1',
        name: 'Level 0',
        type: 'AGENT_STEP',
        status: 'COMPLETED',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        parentId: null,
        duration: 100,
        model: null,
        cost: null,
        promptTokens: null,
        outputTokens: null,
        input: null,
        output: null,
        error: null,
        toolName: null,
      },
      {
        id: 'level-1',
        traceId: 'trace-1',
        name: 'Level 1',
        type: 'LLM_CALL',
        status: 'COMPLETED',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        parentId: 'level-0',
        duration: 100,
        model: null,
        cost: null,
        promptTokens: null,
        outputTokens: null,
        input: null,
        output: null,
        error: null,
        toolName: null,
      },
      {
        id: 'level-2',
        traceId: 'trace-1',
        name: 'Level 2',
        type: 'TOOL_CALL',
        status: 'COMPLETED',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        parentId: 'level-1',
        duration: 100,
        model: null,
        cost: null,
        promptTokens: null,
        outputTokens: null,
        input: null,
        output: null,
        error: null,
        toolName: 'test',
      },
    ]

    render(<SpanTree spans={deepSpans} />)

    expect(screen.getByText('Level 0')).toBeInTheDocument()
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    expect(screen.getByText('Level 2')).toBeInTheDocument()
  })
})
