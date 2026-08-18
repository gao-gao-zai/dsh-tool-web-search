import { SearchError } from './types.js'

/** Request options for the bounded HTTP helper. */
export interface HttpRequestOptions {
  headers?: Record<string, string>
  /** Human-readable endpoint label used in structured error messages. */
  operation?: string
  /** Caller cancellation and timeout signal. */
  signal: AbortSignal
  timeoutMs: number
  maxBytes: number
  retries?: number
}

/** A response whose body has already passed the byte limit. */
export interface HttpResponse {
  status: number
  statusText: string
  url: string
  headers: Headers
  body: string
}

/** Sleep while remaining cancellable by the caller. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('The operation was aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason ?? new DOMException('The operation was aborted', 'AbortError'))
    }, { once: true })
  })
}

/** Read a response body without allowing an unbounded allocation. */
async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  if (response.headers.get('content-length') !== null) {
    const length = Number(response.headers.get('content-length'))
    if (Number.isFinite(length) && length > maxBytes) {
      throw new SearchError('RESPONSE_TOO_LARGE', `response exceeds ${maxBytes} bytes`, false, response.status)
    }
  }

  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maxBytes) {
        await reader.cancel('response too large')
        throw new SearchError('RESPONSE_TOO_LARGE', `response exceeds ${maxBytes} bytes`, false, response.status)
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

/** Perform a cancellable GET with bounded body reads and conservative retries. */
export async function getText(url: string, options: HttpRequestOptions): Promise<HttpResponse> {
  const retries = options.retries ?? 1
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const onAbort = () => controller.abort(options.signal.reason)
    options.signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), options.timeoutMs)
    try {
      const response = await fetch(url, {
        method: 'GET',
        ...(options.headers === undefined ? {} : { headers: options.headers }),
        signal: controller.signal,
      })
      const body = await readBoundedBody(response, options.maxBytes)
      if (response.ok) return { status: response.status, statusText: response.statusText, url: response.url, headers: response.headers, body }

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      const endpoint = options.operation ?? 'search endpoint'
      if (!retryable || attempt >= retries) {
        throw new SearchError(
          response.status === 401 || response.status === 403 ? 'AUTHENTICATION_ERROR' : response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR',
          `${endpoint} returned HTTP ${response.status}`,
          retryable,
          response.status,
        )
      }
    } catch (error) {
      if (error instanceof SearchError) {
        if (!error.retryable || attempt >= retries) throw error
      } else if (options.signal.aborted) {
        throw new SearchError('CANCELLED', 'search request was cancelled', false)
      } else if (controller.signal.aborted) {
        throw new SearchError('TIMEOUT', 'search request timed out', true)
      } else if (attempt >= retries) {
        throw new SearchError('HTTP_ERROR', error instanceof Error ? error.message : String(error), true)
      }
    } finally {
      clearTimeout(timer)
      options.signal.removeEventListener('abort', onAbort)
    }

    await delay(250 * 2 ** attempt, options.signal)
  }
  throw new SearchError('INTERNAL_ERROR', 'search request did not settle')
}
