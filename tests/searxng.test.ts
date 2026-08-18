import { describe, expect, it } from 'vitest'
import { parseSearxngResults } from '../src/search/searxng.js'

describe('SearXNG parser', () => {
  it('projects only the public result fields', () => {
    expect(parseSearxngResults(JSON.stringify({ results: [{ title: 'Title', url: 'https://example.com', content: 'Snippet', engines: ['google'], score: 9 }] }))).toEqual([{ title: 'Title', url: 'https://example.com', snippet: 'Snippet' }])
  })

  it('rejects malformed responses', () => {
    expect(() => parseSearxngResults(JSON.stringify({ results: [{ title: 'missing url' }, { url: 'https://example.com' }] }))).not.toThrow()
    expect(() => parseSearxngResults('{')).toThrow('invalid JSON')
    expect(() => parseSearxngResults('{}')).toThrow('no results array')
  })
})
