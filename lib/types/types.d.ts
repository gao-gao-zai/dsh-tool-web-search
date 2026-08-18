/** Supported concrete search backends. */
export type SearchEngineName = 'bing' | 'searxng';
/** Runtime settings shared by both search backends. */
export interface WebSearchConfig {
    enabled: boolean;
    announceToAgent: boolean;
    engine: SearchEngineName;
    maxResults: number;
    timeoutMs: number;
    maxResponseBytes: number;
    bing: BingConfig;
    searxng: SearxngConfig;
}
/** Bing HTML endpoint options. */
export interface BingConfig {
    market: string;
    setLang?: string;
    userAgent?: string;
}
/** SearXNG JSON endpoint options. */
export interface SearxngConfig {
    baseUrl: string;
    apiKeyRef?: string;
    apiKeyHeader?: string;
    apiKeyPrefix?: string;
    engines?: string[];
    categories?: string[];
}
/** Model-facing search result, deliberately excluding page content. */
export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}
/** Structured error returned to the model when search cannot complete. */
export interface WebSearchError {
    code: string;
    message: string;
    retryable: boolean;
}
/** Canonical tool result shared by both adapters. */
export interface WebSearchOutput {
    results: WebSearchResult[];
    truncated: boolean;
    error?: WebSearchError;
}
/** Raw result shape emitted by an engine adapter before normalization. */
export interface RawSearchResult {
    title: string;
    url: string;
    snippet: string;
}
/** Engine-independent search request. */
export interface SearchRequest {
    query: string;
    limit: number;
    language?: string;
    signal: AbortSignal;
}
/** Engine adapter contract. */
export interface SearchEngine {
    search(request: SearchRequest): Promise<RawSearchResult[]>;
}
/** Search-related error with a stable model-facing code. */
export declare class SearchError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly status?: number;
    constructor(code: string, message: string, retryable?: boolean, status?: number);
}
//# sourceMappingURL=types.d.ts.map