import { parseApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface HttpClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}

const CSRF_HEADER = 'X-CSRF-TOKEN';
const CSRF_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT', 'DELETE']);

/**
 * Transport layer: common headers, JSON (de)serialization, error parsing and CSRF.
 * The CSRF token is fetched before the very first request and re-fetched once on 419.
 * Knows nothing about the auth session — that is handled by `createSessionGuard`.
 */
export function createHttpClient(baseUrl: string): HttpClient {
  let csrfToken: string | null = null;
  let pendingCsrf: Promise<string> | null = null;

  function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const method = options.method ?? 'GET';
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (token !== null && CSRF_METHODS.has(method)) headers.set(CSRF_HEADER, token);

    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
      signal: options.signal ?? null,
      credentials: 'include',
    });
  }

  /** Concurrent callers share one in-flight GET /csrf. */
  function fetchCsrfToken(): Promise<string> {
    pendingCsrf ??= (async () => {
      const response = await send('/csrf', {}, null);
      if (!response.ok) throw await parseApiError(response);
      const token = response.headers.get(CSRF_HEADER);
      if (!token) throw new Error(`${CSRF_HEADER} header is missing in /csrf response`);
      csrfToken = token;
      return token;
    })().finally(() => {
      pendingCsrf = null;
    });
    return pendingCsrf;
  }

  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      let response = await send(path, options, csrfToken ?? (await fetchCsrfToken()));
      if (response.status === 419) {
        response = await send(path, options, await fetchCsrfToken());
      }
      if (!response.ok) throw await parseApiError(response);

      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    },
  };
}
