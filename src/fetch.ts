import TurndownService from 'turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'
import { load } from 'cheerio'
import { getText } from './http.js'
import { SearchError } from './types.js'

/** Runtime limits for one fetched HTTP(S) page. */
export interface WebFetchConfig {
  /** Cooperative request timeout in milliseconds. */
  timeoutMs: number
  /** Maximum response body size read from the network. */
  maxResponseBytes: number
  /** Maximum model-visible rendered output characters. */
  maxOutputChars: number
}

/** Body variants accepted by the model-facing fetch output. */
export interface WebFetchBody {
  /** Whether the source was HTML converted by the renderer or plain text. */
  kind: 'html' | 'text'
  /** Bounded source content retained for rendering. */
  content: string
}

/** Canonical result returned by the page fetch operation. */
export interface WebFetchOutput {
  /** Final URL returned by the HTTP client. */
  url: string
  /** HTTP response status code. */
  statusCode: number
  /** Source body and its content kind. */
  body: WebFetchBody
  /** Whether the provider or source bound cut the body. */
  truncated: boolean
}

/** Shared HTML-to-Markdown converter matching the official web tool's presentation. */
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})
turndown.use(gfm)
turndown.remove(['script', 'style', 'noscript'])

const TRUNCATION_FOOTER = '\n\n(Content truncated. Fetch a more specific URL or section for the full text.)'

/** Validate a model URL before making a network request. */
export function parseFetchUrl(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid fetch arguments')
  const url = (value as Record<string, unknown>).url
  if (typeof url !== 'string' || url.trim() === '') throw new Error('url must be a non-empty string')
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new Error('url must be a valid HTTP(S) URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('url must use HTTP(S)')
  return parsed.href
}

/** Fetch one bounded HTTP(S) page and preserve its source representation. */
export async function fetchPage(url: string, config: WebFetchConfig, signal: AbortSignal): Promise<WebFetchOutput> {
  const response = await getText(url, {
    signal,
    timeoutMs: config.timeoutMs,
    maxBytes: config.maxResponseBytes,
    operation: 'web page',
    headers: {
      accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
      'user-agent': 'dsh-tool-web-search/0.1.0',
    },
  })
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
  const isText = contentType === '' || contentType.includes('text/plain') || contentType.includes('application/json') || contentType.includes('application/xml')
  if (!isHtml && !isText) throw new SearchError('INVALID_RESPONSE', `unsupported web page content type: ${contentType || 'unknown'}`, false, response.status)
  return {
    url: response.url || url,
    statusCode: response.status,
    body: { kind: isHtml ? 'html' : 'text', content: response.body },
    truncated: false,
  }
}

/** Render one fetched source to a bounded model-visible text block. */
export function renderFetchOutput(result: WebFetchOutput, maxOutputChars: number): { text: string; truncated: boolean } {
  const source = result.body.content.slice(0, maxOutputChars)
  const sourceTruncated = source.length !== result.body.content.length
  let rendered = source
  if (result.body.kind === 'html') {
    try {
      // Remove executable/non-content nodes before conversion while preserving the
      // remaining markup for Turndown's GFM table and code-block rules.
      const document = load(source)
      document('script,style,noscript').remove()
      rendered = turndown.turndown(document('body').html() ?? source)
    } catch {
      rendered = source
    }
  }
  const prefix = `Fetched ${result.url} (HTTP ${result.statusCode})\n\n${rendered}`
  const truncated = result.truncated || sourceTruncated || prefix.length > maxOutputChars
  const full = `${prefix}${truncated ? TRUNCATION_FOOTER : ''}`
  if (full.length <= maxOutputChars) return { text: full, truncated }
  if (maxOutputChars < TRUNCATION_FOOTER.length + 1) return { text: full.slice(0, maxOutputChars), truncated: true }
  return {
    text: `${prefix.slice(0, maxOutputChars - TRUNCATION_FOOTER.length)}${TRUNCATION_FOOTER}`,
    truncated: true,
  }
}
