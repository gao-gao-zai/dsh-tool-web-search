import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { fetchPage, parseFetchUrl, renderFetchOutput } from './fetch.js'
import type { WebFetchConfig, WebFetchOutput } from './fetch.js'
import { createBingEngine, createBingRequest } from './search/bing.js'
import { createSearxngEngine, createSearxngRequest } from './search/searxng.js'
import { boundResults, deduplicateResults, normalizeResult, renderResults } from './search/normalize.js'
import { SearchError } from './types.js'
import type { SearchEngine, WebSearchConfig, WebSearchError, WebSearchOutput } from './types.js'

/** Stable Cordis plugin name. */
export const name = 'web-search'

/** Services required by the model-facing search tool. */
export const inject = ['tools', 'systemPrompt']

/** Settings namespace owned by this plugin. */
export const WEB_SEARCH_SETTINGS_NAMESPACE = settingsNamespace('dsh-web-search')

/** Schema defaults for the persistent search configuration. */
export const Config = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(true),
  fetch: z.boolean().default(true),
  engine: z.union([z.const('bing'), z.const('searxng')]).default('bing'),
  maxResults: z.number().default(10),
  timeoutMs: z.number().default(30_000),
  fetchTimeoutMs: z.number().default(30_000),
  maxResponseBytes: z.number().default(2_000_000),
  fetchMaxOutputChars: z.number().default(200_000),
  bing: z.object({
    market: z.string().default('zh-CN'),
    setLang: z.string().default('zh-CN'),
    userAgent: z.string().default(''),
  }).default({ market: 'zh-CN', setLang: 'zh-CN', userAgent: '' }),
  searxng: z.object({
    baseUrl: z.string().default(''),
    apiKeyRef: z.string().default('SEARXNG_API_KEY'),
    apiKeyHeader: z.string().default('Authorization'),
    apiKeyPrefix: z.string().default('Bearer '),
    engines: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
  }).default({ baseUrl: '', apiKeyRef: 'SEARXNG_API_KEY', apiKeyHeader: 'Authorization', apiKeyPrefix: 'Bearer ', engines: [], categories: [] }),
})

const SEARCH_GUIDANCE = 'Use web_search to discover current information through the configured Bing or SearXNG backend. It returns bounded titles, URLs, and snippets. Follow up with web_fetch when you need the full content of a specific HTTP(S) result, and cite the relevant URLs as markdown links.'

const DEFAULT_CONFIG: WebSearchConfig = {
  enabled: true,
  announceToAgent: true,
  fetch: true,
  engine: 'bing',
  maxResults: 10,
  timeoutMs: 30_000,
  fetchTimeoutMs: 30_000,
  maxResponseBytes: 2_000_000,
  fetchMaxOutputChars: 200_000,
  bing: { market: 'zh-CN', setLang: 'zh-CN', userAgent: '' },
  searxng: { baseUrl: '', apiKeyRef: 'SEARXNG_API_KEY', apiKeyHeader: 'Authorization', apiKeyPrefix: 'Bearer ', engines: [], categories: [] },
}

/** Merge composition/settings layers into a complete immutable runtime config. */
function completeConfig(input: Partial<WebSearchConfig> | undefined): WebSearchConfig {
  return {
    ...DEFAULT_CONFIG,
    ...input,
    bing: { ...DEFAULT_CONFIG.bing, ...input?.bing },
    searxng: { ...DEFAULT_CONFIG.searxng, ...input?.searxng },
  }
}

/** Reject unsafe timeout, response, and result limits before registering a tool. */
function assertConfig(config: WebSearchConfig): void {
  if (!Number.isInteger(config.maxResults) || config.maxResults < 1 || config.maxResults > 10) throw new Error('maxResults must be an integer between 1 and 10')
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1) throw new Error('timeoutMs must be a positive integer')
  if (!Number.isInteger(config.fetchTimeoutMs) || config.fetchTimeoutMs < 1) throw new Error('fetchTimeoutMs must be a positive integer')
  if (!Number.isInteger(config.maxResponseBytes) || config.maxResponseBytes < 1) throw new Error('maxResponseBytes must be a positive integer')
  if (!Number.isInteger(config.fetchMaxOutputChars) || config.fetchMaxOutputChars < 1) throw new Error('fetchMaxOutputChars must be a positive integer')
  if (config.engine === 'searxng' && !config.searxng.baseUrl) throw new Error('SearXNG baseUrl must be configured')
}

const TOOL_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', required: true },
          url: { type: 'string', required: true },
          snippet: { type: 'string', required: true },
        },
      },
    },
    truncated: { type: 'boolean', required: true },
    error: {
      type: 'object',
      additionalProperties: false,
      properties: {
        code: { type: 'string', required: true },
        message: { type: 'string', required: true },
        retryable: { type: 'boolean', required: true },
      },
    },
  },
} as const

const FETCH_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    url: { type: 'string', required: true },
    statusCode: { type: 'integer', required: true },
    body: {
      required: true,
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: { type: 'string', required: true, const: 'html' },
            content: { type: 'string', required: true },
          },
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: { type: 'string', required: true, const: 'text' },
            content: { type: 'string', required: true },
          },
        },
      ],
    },
    truncated: { type: 'boolean', required: true },
  },
} as const


function toSearchError(error: unknown): WebSearchError {
  if (error instanceof SearchError) return { code: error.code, message: error.message, retryable: error.retryable }
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('credential')) return { code: 'MISSING_CREDENTIAL', message, retryable: false }
  if (message.includes('baseUrl')) return { code: 'INVALID_CONFIG', message, retryable: false }
  return { code: 'INTERNAL_ERROR', message: 'search failed unexpectedly', retryable: false }
}

/** Validate model arguments that are stricter than the JSON schema. */
function parseArgs(args: unknown): { query: string; limit: number; language?: string } {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) throw new Error('invalid search arguments')
  const value = args as Record<string, unknown>
  if (typeof value.query !== 'string' || value.query.trim() === '') throw new Error('query must be a non-empty string')
  const limit = value.limit === undefined ? 10 : value.limit
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('limit must be an integer between 1 and 10')
  if (value.language !== undefined && typeof value.language !== 'string') throw new Error('language must be a string')
  return {
    query: value.query.trim(),
    limit,
    ...(value.language === undefined ? {} : { language: value.language }),
  }
}

/** Build the selected concrete engine from one immutable settings snapshot. */
function createEngine(config: WebSearchConfig, resolveApiKey: () => Promise<string | undefined>): SearchEngine {
  if (config.engine === 'bing') {
    const request = createBingRequest(config.timeoutMs, config.maxResponseBytes)
    return createBingEngine(config.bing, request)
  }
  const request = createSearxngRequest(config.timeoutMs, config.maxResponseBytes)
  return createSearxngEngine(config.searxng, request, resolveApiKey)
}

/** Execute one bounded search and preserve a JSON-only canonical result. */
async function executeSearch(config: WebSearchConfig, args: unknown, signal: AbortSignal, resolveApiKey: () => Promise<string | undefined>): Promise<WebSearchOutput> {
  const parsed = parseArgs(args)
  try {
    const engine = createEngine(config, resolveApiKey)
    const raw = await engine.search({ ...parsed, signal })
    const normalized = raw.map(normalizeResult).filter((result): result is NonNullable<typeof result> => result !== undefined)
    const deduplicated = deduplicateResults(normalized)
    const bounded = boundResults(deduplicated, Math.min(parsed.limit, config.maxResults))
    return { results: bounded.results, truncated: bounded.truncated }
  } catch (error) {
    return { results: [], truncated: false, error: toSearchError(error) }
  }
}

/** Register the model-facing search tool for one settings snapshot. */
function registerTool(ctx: any, config: WebSearchConfig, resolveApiKey: () => Promise<string | undefined>): () => void {
  return ctx.tools.register(defineTool({
    name: 'web_search',
    description: 'Search Bing or SearXNG for current information through the configured backend. Returns bounded titles, URLs, and short snippets; use web_fetch to read a specific result page.',
    parameters: {
      query: { type: 'string', required: true, description: 'Search keywords.' },
      limit: { type: 'integer', description: 'Maximum results, from 1 to 10. Defaults to 10.' },
      language: { type: 'string', description: 'Optional language or market code, such as zh-CN or en-US.' },
    },
    output: {
      schema: TOOL_OUTPUT_SCHEMA,
      render: (_args: unknown, value: WebSearchOutput) => [{ type: 'text', text: renderResults(value) }],
    },
    timeoutMs: config.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args: unknown, exec: { signal: AbortSignal }) {
      return executeSearch(config, args, exec.signal, resolveApiKey)
    },
  }))
}

/** Register the model-facing webpage fetch tool for one settings snapshot. */
function registerFetchTool(ctx: any, config: WebSearchConfig): () => void {
  const fetchConfig: WebFetchConfig = {
    timeoutMs: config.fetchTimeoutMs,
    maxResponseBytes: config.maxResponseBytes,
    maxOutputChars: config.fetchMaxOutputChars,
  }
  return ctx.tools.register(defineTool({
    name: 'web_fetch',
    description: 'Fetch the content of a specific HTTP(S) URL and return it decoded to Markdown or text.',
    parameters: {
      url: { type: 'string', required: true, description: 'The HTTP(S) URL to fetch.' },
    },
    output: {
      schema: FETCH_OUTPUT_SCHEMA,
      render: (_args: unknown, value: WebFetchOutput) => [{ type: 'text', text: renderFetchOutput(value, fetchConfig.maxOutputChars).text }],
    },
    timeoutMs: config.fetchTimeoutMs,
    isConcurrencySafe: () => true,
    async execute(args: unknown, exec: { signal: AbortSignal }) {
      const url = parseFetchUrl(args)
      return fetchPage(url, fetchConfig, exec.signal)
    },
  }))
}

/** Mount the persistent web search tool and live configuration synchronization. */
export function apply(ctx: any, entry?: Partial<WebSearchConfig>): void {
  let current: () => Partial<WebSearchConfig> = () => entry ?? {}
  let disposeTools: (() => void) | undefined
  let disposePrompt: (() => void) | undefined
  const credentials = ctx.get('credentials') as { resolve(ref: string): Promise<{ value: string } | undefined> } | undefined

  const resolveConfig = (): WebSearchConfig => completeConfig(current())
  const resolveApiKey = async (): Promise<string | undefined> => {
    const ref = resolveConfig().searxng.apiKeyRef
    if (!ref) return undefined
    if (credentials) return (await credentials.resolve(credentialRef(ref)))?.value
    return process.env[ref] || undefined
  }
  const sync = (): void => {
    disposeTools?.()
    disposeTools = undefined
    disposePrompt?.()
    disposePrompt = undefined
    const config = resolveConfig()
    assertConfig(config)
    if (!config.enabled) return
    const disposers = [registerTool(ctx, config, resolveApiKey)]
    if (config.fetch) disposers.push(registerFetchTool(ctx, config))
    disposeTools = () => {
      for (const dispose of disposers) dispose()
    }
    if (config.announceToAgent) disposePrompt = ctx.systemPrompt.section({ name: 'plugin:dsh-web-search', order: 145, text: SEARCH_GUIDANCE })
  }

  installSettingsSection(ctx, WEB_SEARCH_SETTINGS_NAMESPACE, Config, entry ?? {}, {
    setSource: (source: () => WebSearchConfig) => {
      current = source
      sync()
    },
    onChange: sync,
  })
  sync()
}
