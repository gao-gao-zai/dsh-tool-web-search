import type { RawSearchResult, SearchEngine, SearxngConfig } from '../types.js';
/** Parse and project the SearXNG JSON result list. */
export declare function parseSearxngResults(body: string): RawSearchResult[];
/** Create a SearXNG JSON search adapter. */
export declare function createSearxngEngine(config: SearxngConfig, request: (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<string>, resolveApiKey: () => Promise<string | undefined>): SearchEngine;
/** Default request implementation for the SearXNG adapter. */
export declare function createSearxngRequest(timeoutMs: number, maxResponseBytes: number): (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<string>;
//# sourceMappingURL=searxng.d.ts.map