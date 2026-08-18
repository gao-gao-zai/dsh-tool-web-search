import { getText } from '../http.js'
import { SearchError } from '../types.js'
import type { RawSearchResult, SearchEngine, SearchRequest, SearxngConfig } from '../types.js'

interface SearxngPayload {
  results?: unknown
}

/** Narrow one SearXNG result to the fields this tool exposes. */
function mapResult(value: unknown): RawSearchResult | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const result = value as Record<string, unknown>
  if (typeof result.title !== 'string' || typeof result.url !== 'string') return undefined
  const content = typeof result.content === 'string' ? result.content : typeof result.snippet === 'string' ? result.snippet : ''
  if (!content) return undefined
  return { title: result.title, url: result.url, snippet: content }
}

/** Parse and project the SearXNG JSON result list. */
export function parseSearxngResults(body: string): RawSearchResult[] {
  let payload: SearxngPayload
  try {
    payload = JSON.parse(body) as SearxngPayload
  } catch {
    throw new SearchError('INVALID_RESPONSE', 'SearXNG returned invalid JSON', false)
  }
  if (!Array.isArray(payload.results)) throw new SearchError('INVALID_RESPONSE', 'SearXNG response has no results array', false)
  return payload.results.map(mapResult).filter((value): value is RawSearchResult => value !== undefined)
}

/** Create a SearXNG JSON search adapter. */
export function createSearxngEngine(
  config: SearxngConfig,
  request: (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<string>,
  resolveApiKey: () => Promise<string | undefined>,
): SearchEngine {
  return {
    async search({ query, limit, language, signal }: SearchRequest): Promise<RawSearchResult[]> {
      const base = new URL(config.baseUrl)
      if (base.protocol !== 'http:' && base.protocol !== 'https:') throw new Error('SearXNG baseUrl must use http or https')
      base.pathname = `${base.pathname.replace(/\/$/, '')}/search`
      base.search = ''
      base.searchParams.set('q', query)
      base.searchParams.set('format', 'json')
      if (language) base.searchParams.set('language', language)
      if (config.engines?.length) base.searchParams.set('engines', config.engines.join(','))
      if (config.categories?.length) base.searchParams.set('categories', config.categories.join(','))

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'dsh-web-search/0.1',
      }
      if (config.apiKeyRef) {
        const apiKey = await resolveApiKey()
        if (!apiKey) throw new Error(`credential ${config.apiKeyRef} is not configured`)
        headers[config.apiKeyHeader ?? 'Authorization'] = `${config.apiKeyPrefix ?? 'Bearer '}${apiKey}`
      }
      return request(base.toString(), headers, signal).then((body) => parseSearxngResults(body).slice(0, limit))
    },
  }
}

/** Default request implementation for the SearXNG adapter. */
export function createSearxngRequest(timeoutMs: number, maxResponseBytes: number) {
  return (url: string, headers: Record<string, string>, signal: AbortSignal) => getText(url, {
    headers,
    signal,
    timeoutMs,
    maxBytes: maxResponseBytes,
    retries: 1,
  }).then((response) => response.body)
}
