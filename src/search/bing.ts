import { load } from 'cheerio'
import { getText } from '../http.js'
import type { BingConfig, RawSearchResult, SearchEngine, SearchRequest } from '../types.js'

const DEFAULT_USER_AGENT = 'dsh-web-search/0.1 (+https://github.com/zhu1090093659/dsh-web-ui)'

/** Decode Bing's `ck/a` result wrapper used by its public HTML page. */
export function decodeBingUrl(rawUrl: string): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return undefined
  }

  if (!parsed.hostname.endsWith('bing.com') || !parsed.pathname.includes('/ck/a')) return rawUrl
  const encoded = parsed.searchParams.get('u') ?? parsed.searchParams.get('url')
  if (!encoded) return undefined
  const payload = encoded.startsWith('a1') ? encoded.slice(2) : encoded
  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    if (/^https?:\/\//i.test(decoded)) return decoded
  } catch {
    return undefined
  }
  return undefined
}

/** Extract title, external URL and snippet fields from Bing result HTML. */
export function parseBingResults(html: string): RawSearchResult[] {
  const $ = load(html)
  const results: RawSearchResult[] = []
  $('li.b_algo').each((_, element) => {
    const item = $(element)
    const anchor = item.find('h2 a').first()
    const title = anchor.text().replace(/\s+/g, ' ').trim()
    const href = anchor.attr('href')
    const url = href ? decodeBingUrl(href) : undefined
    const snippet = item.find('.b_caption p, p, .b_lineclamp2').first().text().replace(/\s+/g, ' ').trim()
    if (title && url && snippet) results.push({ title, url, snippet })
  })
  return results
}

/** Create a Bing HTML search adapter. */
export function createBingEngine(config: BingConfig, request: (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<string>): SearchEngine {
  return {
    async search({ query, limit, language, signal }: SearchRequest): Promise<RawSearchResult[]> {
      const params = new URLSearchParams({
        q: query,
        count: String(Math.min(limit + 5, 20)),
        mkt: language ?? config.market,
        setlang: config.setLang ?? language ?? config.market,
      })
      const html = await request(`https://www.bing.com/search?${params.toString()}`, {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': language ?? config.market,
        'User-Agent': config.userAgent || DEFAULT_USER_AGENT,
      }, signal)
      return parseBingResults(html).slice(0, limit)
    },
  }
}

/** Default request implementation for the Bing adapter. */
export function createBingRequest(timeoutMs: number, maxResponseBytes: number) {
  return (url: string, headers: Record<string, string>, signal: AbortSignal) => getText(url, {
    headers,
    signal,
    timeoutMs,
    maxBytes: maxResponseBytes,
    retries: 1,
  }).then((response) => response.body)
}
