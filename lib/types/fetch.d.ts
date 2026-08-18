/** Runtime limits for one fetched HTTP(S) page. */
export interface WebFetchConfig {
    /** Cooperative request timeout in milliseconds. */
    timeoutMs: number;
    /** Maximum response body size read from the network. */
    maxResponseBytes: number;
    /** Maximum model-visible rendered output characters. */
    maxOutputChars: number;
}
/** Body variants accepted by the model-facing fetch output. */
export interface WebFetchBody {
    /** Whether the source was HTML converted by the renderer or plain text. */
    kind: 'html' | 'text';
    /** Bounded source content retained for rendering. */
    content: string;
}
/** Canonical result returned by the page fetch operation. */
export interface WebFetchOutput {
    /** Final URL returned by the HTTP client. */
    url: string;
    /** HTTP response status code. */
    statusCode: number;
    /** Source body and its content kind. */
    body: WebFetchBody;
    /** Whether the provider or source bound cut the body. */
    truncated: boolean;
}
/** Validate a model URL before making a network request. */
export declare function parseFetchUrl(value: unknown): string;
/** Fetch one bounded HTTP(S) page and preserve its source representation. */
export declare function fetchPage(url: string, config: WebFetchConfig, signal: AbortSignal): Promise<WebFetchOutput>;
/** Render one fetched source to a bounded model-visible text block. */
export declare function renderFetchOutput(result: WebFetchOutput, maxOutputChars: number): {
    text: string;
    truncated: boolean;
};
//# sourceMappingURL=fetch.d.ts.map