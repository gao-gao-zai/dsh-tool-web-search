import { describe, expect, it } from 'vitest'
import { parseFetchUrl, renderFetchOutput, type WebFetchOutput } from '../src/fetch.js'

describe('web fetch', () => {
  it('accepts only HTTP(S) URLs', () => {
    expect(parseFetchUrl({ url: 'https://example.com/a' })).toBe('https://example.com/a')
    expect(() => parseFetchUrl({ url: 'file:///tmp/a' })).toThrow('HTTP(S)')
    expect(() => parseFetchUrl({ url: '   ' })).toThrow('non-empty')
  })

  it('converts HTML to bounded Markdown and removes executable nodes', () => {
    const result: WebFetchOutput = {
      url: 'https://example.com/article',
      statusCode: 200,
      body: {
        kind: 'html',
        content: '<html><body><h1>Title</h1><script>alert(1)</script><table><tr><th>A</th></tr><tr><td>B</td></tr></table></body></html>',
      },
      truncated: false,
    }
    const rendered = renderFetchOutput(result, 500)
    expect(rendered.text).toContain('# Title')
    expect(rendered.text).toContain('| A   |')
    expect(rendered.text).not.toContain('alert')
    expect(rendered.truncated).toBe(false)
  })

  it('adds a truncation notice when rendered output exceeds the cap', () => {
    const result: WebFetchOutput = {
      url: 'https://example.com/article',
      statusCode: 200,
      body: { kind: 'text', content: 'x'.repeat(200) },
      truncated: false,
    }
    const rendered = renderFetchOutput(result, 100)
    expect(rendered.truncated).toBe(true)
    expect(rendered.text.length).toBe(100)
    expect(rendered.text).toContain('Content truncated')
  })
})
