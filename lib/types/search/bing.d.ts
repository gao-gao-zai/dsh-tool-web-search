import type { BingConfig, RawSearchResult, SearchEngine } from '../types.js';
/** Decode Bing's `ck/a` result wrapper used by its public HTML page. */
export declare function decodeBingUrl(rawUrl: string): string | undefined;
/** Extract title, external URL and snippet fields from Bing result HTML. */
export declare function parseBingResults(html: string): RawSearchResult[];
/** Create a Bing HTML search adapter. */
export declare function createBingEngine(config: BingConfig, request: (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<string>): SearchEngine;
/** Default request implementation for the Bing adapter. */
export declare function createBingRequest(timeoutMs: number, maxResponseBytes: number): (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<string>;
//# sourceMappingURL=bing.d.ts.map