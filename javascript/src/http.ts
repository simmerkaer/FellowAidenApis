import { ApiError } from './errors.js';

/** HTTP status codes that are safe to retry (transient). Mirrors the Python retry set. */
const RETRYABLE_STATUSES = new Set([408, 500, 502, 503, 504]);

export interface HttpClientOptions {
  baseUrl: string;
  userAgent: string;
  /** Returns the current bearer token, or null if not authenticated yet. */
  getToken: () => string | null;
  /** Re-authenticates (called once on a 401) and updates the token. */
  reauthenticate: () => Promise<void>;
  /** Max retries for transient failures. Default 3. */
  maxRetries?: number;
  /** Base backoff in ms between retries (multiplied by attempt number). Default 300. */
  retryDelayMs?: number;
  /** Injectable sleep, primarily for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable fetch, primarily for tests. Defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  /** Query string parameters. */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON body; serialized with JSON.stringify. */
  body?: unknown;
  /** Skip JSON parsing and return the raw text (used for delete/empty responses). */
  raw?: boolean;
  /** Do not attempt re-authentication on a 401 (used by the login request itself). */
  skipReauth?: boolean;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Thin fetch wrapper that injects auth + default headers, retries transient
 * failures, and transparently re-authenticates once on a 401.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly getToken: () => string | null;
  private readonly reauthenticate: () => Promise<void>;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.userAgent = options.userAgent;
    this.getToken = options.getToken;
    this.reauthenticate = options.reauthenticate;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 300;
    this.sleep = options.sleep ?? defaultSleep;
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== 'function') {
      throw new Error(
        'No fetch implementation available. Use Node 18+, or pass a fetch in options.',
      );
    }
    this.fetchImpl = f.bind(globalThis);
  }

  get(path: string, opts?: RequestOptions): Promise<any> {
    return this.request('GET', path, opts);
  }
  post(path: string, opts?: RequestOptions): Promise<any> {
    return this.request('POST', path, opts);
  }
  patch(path: string, opts?: RequestOptions): Promise<any> {
    return this.request('PATCH', path, opts);
  }
  delete(path: string, opts?: RequestOptions): Promise<any> {
    return this.request('DELETE', path, opts);
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildInit(method: Method, body: unknown): RequestInit {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Accept: 'application/json',
    };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return init;
  }

  /**
   * Performs the request with transient-failure retries and a single
   * re-auth-and-retry on 401.
   */
  private async request(method: Method, path: string, opts: RequestOptions = {}): Promise<any> {
    const url = this.buildUrl(path, opts.query);
    let reauthed = false;

    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, this.buildInit(method, opts.body));
      } catch (err) {
        // Network-level failure — retry while attempts remain.
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * (attempt + 1));
          continue;
        }
        throw err;
      }

      if (response.status === 401 && !reauthed && !opts.skipReauth) {
        reauthed = true;
        await this.reauthenticate();
        continue; // retry once with the fresh token (does not consume a retry slot)
      }

      if (RETRYABLE_STATUSES.has(response.status) && attempt < this.maxRetries) {
        await this.sleep(this.retryDelayMs * (attempt + 1));
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        throw new ApiError(response.status, parseMaybeJson(text));
      }
      if (opts.raw) return text;
      return text ? parseMaybeJson(text) : null;
    }
  }
}

function parseMaybeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
