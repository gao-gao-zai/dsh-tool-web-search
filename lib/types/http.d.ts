/** Request options for the bounded HTTP helper. */
export interface HttpRequestOptions {
    headers?: Record<string, string>;
    /** Human-readable endpoint label used in structured error messages. */
    operation?: string;
    /** Caller cancellation and timeout signal. */
    signal: AbortSignal;
    timeoutMs: number;
    maxBytes: number;
    retries?: number;
}
/** A response whose body has already passed the byte limit. */
export interface HttpResponse {
    status: number;
    statusText: string;
    url: string;
    headers: Headers;
    body: string;
}
/** Perform a cancellable GET with bounded body reads and conservative retries. */
export declare function getText(url: string, options: HttpRequestOptions): Promise<HttpResponse>;
//# sourceMappingURL=http.d.ts.map