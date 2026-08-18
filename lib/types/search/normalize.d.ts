import type { RawSearchResult, WebSearchOutput, WebSearchResult } from '../types.js';
/** Hard model-facing result limits. */
export declare const MAX_RESULTS = 10;
export declare const MAX_SNIPPET_CHARS = 200;
export declare const MAX_TITLE_CHARS = 300;
export declare const MAX_URL_CHARS = 4096;
export declare const MAX_OUTPUT_CHARS = 16000;
/** Trim a string by Unicode code points so surrogate pairs stay intact. */
export declare function truncateChars(value: string, max: number): string;
/** Normalize one engine result without exposing engine-specific fields. */
export declare function normalizeResult(result: RawSearchResult): WebSearchResult | undefined;
/** Remove duplicate pages while preserving engine relevance order. */
export declare function deduplicateResults(results: WebSearchResult[]): WebSearchResult[];
/** Apply count and rendered-output bounds to canonical results. */
export declare function boundResults(results: WebSearchResult[], requestedLimit: number): {
    results: WebSearchResult[];
    truncated: boolean;
};
/** Render only the bounded link-and-snippet projection for the model. */
export declare function renderResults(output: WebSearchOutput): string;
//# sourceMappingURL=normalize.d.ts.map