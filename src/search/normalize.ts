import type { RawSearchResult, WebSearchOutput, WebSearchResult } from '../types.js'

/** Hard model-facing result limits. */
export const MAX_RESULTS = 10
export const MAX_SNIPPET_CHARS = 200
export const MAX_TITLE_CHARS = 300
export const MAX_URL_CHARS = 4096
export const MAX_OUTPUT_CHARS = 16_000

/** Trim a string by Unicode code points so surrogate pairs stay intact. */
export function truncateChars(value: string, max: number): string {
  return Array.from(value).slice(0, max).join('')
}

/** Normalize one engine result without exposing engine-specific fields. */
export function normalizeResult(result: RawSearchResult): WebSearchResult | undefined {
  const title = truncateChars(result.title.replace(/\s+/g, ' ').trim(), MAX_TITLE_CHARS)
  const snippet = truncateChars(result.snippet.replace(/\s+/g, ' ').trim(), MAX_SNIPPET_CHARS)
  const url = result.url.trim()
  if (!title || !snippet || url.length > MAX_URL_CHARS) return undefined

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
  return { title, url: parsed.toString(), snippet }
}

/** Remove duplicate pages while preserving engine relevance order. */
export function deduplicateResults(results: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>()
  return results.filter((result) => {
    const host = new URL(result.url).hostname.replace(/^www\./, '').toLowerCase()
    const key = `${host}|${result.title.toLocaleLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Apply count and rendered-output bounds to canonical results. */
export function boundResults(results: WebSearchResult[], requestedLimit: number): { results: WebSearchResult[]; truncated: boolean } {
  const limited = results.slice(0, Math.min(MAX_RESULTS, Math.max(1, requestedLimit)))
  const bounded: WebSearchResult[] = []
  let outputLength = 0
  let truncated = limited.length < results.length

  for (const result of limited) {
    const block = `- [${result.title}](${result.url}) — ${result.snippet}`
    if (outputLength + block.length + (bounded.length > 0 ? 1 : 0) > MAX_OUTPUT_CHARS) {
      truncated = true
      break
    }
    bounded.push(result)
    outputLength += block.length + (bounded.length > 1 ? 1 : 0)
  }

  return { results: bounded, truncated }
}

/** Render only the bounded link-and-snippet projection for the model. */
export function renderResults(output: WebSearchOutput): string {
  if (output.error) return `Search error [${output.error.code}]: ${truncateChars(output.error.message, 500)}`
  if (output.results.length === 0) return 'No search results found.'
  const lines = output.results.map((result) => `- [${result.title}](${result.url}) — ${result.snippet}`)
  if (output.truncated) lines.push('(Additional results were omitted due to the output limit.)')
  return truncateChars(lines.join('\n'), MAX_OUTPUT_CHARS)
}
