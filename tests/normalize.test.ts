import { describe, expect, it } from 'vitest'
import { MAX_OUTPUT_CHARS, boundResults, deduplicateResults, normalizeResult, renderResults } from '../src/search/normalize.js'

describe('result normalization', () => {
  it('deduplicates by normalized host and title', () => {
    const first = normalizeResult({ title: 'Same', url: 'https://www.example.com/a', snippet: 'One' })
    const second = normalizeResult({ title: 'Same', url: 'https://example.com/b', snippet: 'Two' })
    expect(first && second).toBeTruthy()
    expect(deduplicateResults([first!, second!])).toHaveLength(1)
  })

  it('enforces the total rendered output cap', () => {
    const results = Array.from({ length: 10 }, (_, index) => normalizeResult({
      title: `Title ${index}`,
      url: `https://example.com/${index}`,
      snippet: 'x'.repeat(200),
    })).filter((value) => value !== undefined)
    const bounded = boundResults(results, 10)
    expect(renderResults({ results: bounded.results, truncated: bounded.truncated }).length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS)
  })
})
