/** Supported concrete search backends. */
export type SearchEngineName = 'bing' | 'searxng'

/** Runtime settings shared by both search backends. */
export interface WebSearchConfig {
  /** Whether the plugin registers its model-facing tools. */
  enabled: boolean
  /** Whether the plugin adds its operational guidance to the system prompt. */
  announceToAgent: boolean
  /** Whether the plugin registers the search and fetch tools. */
  fetch: boolean
  /** Search backend selection. */
  engine: SearchEngineName
  /** Maximum search results before rendering. */
  maxResults: number
  /** Search request timeout in milliseconds. */
  timeoutMs: number
  /** Fetch request timeout in milliseconds. */
  fetchTimeoutMs: number
  /** Maximum HTTP response bytes for either search or fetch. */
  maxResponseBytes: number
  /** Maximum rendered web_fetch output characters. */
  fetchMaxOutputChars: number
  /** Bing settings. */
  bing: BingConfig
  /** SearXNG settings. */
  searxng: SearxngConfig
}

/** Bing HTML endpoint options. */
export interface BingConfig {
  market: string
  setLang?: string
  userAgent?: string
}

/** SearXNG JSON endpoint options. */
export interface SearxngConfig {
  baseUrl: string
  apiKeyRef?: string
  apiKeyHeader?: string
  apiKeyPrefix?: string
  engines?: string[]
  categories?: string[]
}

/** Model-facing search result, deliberately excluding page content. */
export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

/** Structured error returned to the model when search cannot complete. */
export interface WebSearchError {
  code: string
  message: string
  retryable: boolean
}

/** Canonical tool result shared by both adapters. */
export interface WebSearchOutput {
  results: WebSearchResult[]
  truncated: boolean
  error?: WebSearchError
}

/** Raw result shape emitted by an engine adapter before normalization. */
export interface RawSearchResult {
  title: string
  url: string
  snippet: string
}

/** Engine-independent search request. */
export interface SearchRequest {
  query: string
  limit: number
  language?: string
  signal: AbortSignal
}

/** Engine adapter contract. */
export interface SearchEngine {
  search(request: SearchRequest): Promise<RawSearchResult[]>
}

/** Search-related error with a stable model-facing code. */
export class SearchError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly status?: number

  constructor(code: string, message: string, retryable = false, status?: number) {
    super(message)
    this.name = 'SearchError'
    this.code = code
    this.retryable = retryable
    if (status !== undefined) this.status = status
  }
}
