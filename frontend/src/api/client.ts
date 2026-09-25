import { ApiError } from './errors';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null | Array<string | number | boolean>>;
  timeoutMs?: number;
  token?: string | null;
  /** Internal flag to prevent infinite refresh retry loops */
  _isRetry?: boolean;
}

export type TokenGetter = () => string | null;
export type RefreshHandler = () => Promise<string | null>;
export type AuthExpiredHandler = () => void;

export interface ApiClientConfig {
  baseUrl?: string;
  getToken?: TokenGetter;
  onUnauthorized?: RefreshHandler;
  onAuthExpired?: AuthExpiredHandler;
}

/**
 * Centralized Fetch API Client for the AI Fitness & Nutrition platform.
 * Supports typed requests, Bearer token injection, query string serialization,
 * timeout/abort handling, concurrent 401 refresh queuing, and single-retry semantics.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private tokenGetter: TokenGetter;
  private onUnauthorized?: RefreshHandler;
  private onAuthExpired?: AuthExpiredHandler;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: ApiClientConfig = {}) {
    const rawBaseUrl =
      config.baseUrl ??
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
        ? (import.meta.env.VITE_API_BASE_URL as string)
        : 'http://localhost:8000');

    // Trim trailing slashes from baseUrl
    this.baseUrl = rawBaseUrl.replace(/\/+$/, '');

    // Default token getter reads from localStorage
    this.tokenGetter =
      config.getToken ??
      (() => {
        try {
          return typeof window !== 'undefined' ? localStorage.getItem('fitness_access_token') : null;
        } catch {
          return null;
        }
      });

    this.onUnauthorized = config.onUnauthorized;
    this.onAuthExpired = config.onAuthExpired;
  }

  /**
   * Set or update the token provider function.
   */
  public setTokenGetter(getter: TokenGetter): void {
    this.tokenGetter = getter;
  }

  /**
   * Set or update the 401 unauthorized refresh handler.
   */
  public setOnUnauthorized(handler?: RefreshHandler): void {
    this.onUnauthorized = handler;
  }

  /**
   * Set or update the session expiration callback (clears state and redirects to /login).
   */
  public setOnAuthExpired(handler?: AuthExpiredHandler): void {
    this.onAuthExpired = handler;
  }

  /**
   * Helper to clear tokens from local storage.
   */
  public clearStoredTokens(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('fitness_access_token');
        localStorage.removeItem('fitness_refresh_token');
      }
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Build complete URL from base URL and endpoint, normalizing path and query parameters.
   */
  public buildUrl(path: string, params?: RequestOptions['params']): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const base = this.baseUrl;
    const urlString = `${base}${normalizedPath}`;

    const url = new URL(urlString);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (item !== undefined && item !== null && item !== '') {
                url.searchParams.append(key, String(item));
              }
            });
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    return url.toString();
  }

  /**
   * Core request method.
   */
  public async request<T>(path: string, options: RequestOptions & { body?: unknown } = {}): Promise<T> {
    const { params, timeoutMs = 15000, token: explicitToken, body, headers: customHeaders, _isRetry = false, ...fetchInit } = options;

    const url = this.buildUrl(path, params);
    const headers = new Headers(customHeaders || {});

    // Attach Bearer token if available
    const activeToken = explicitToken !== undefined ? explicitToken : this.tokenGetter();
    if (activeToken) {
      headers.set('Authorization', `Bearer ${activeToken}`);
    }

    // Prepare body and Content-Type header
    let serializedBody: BodyInit | null = null;
    if (body !== undefined && body !== null) {
      if (typeof body === 'string' || body instanceof FormData || body instanceof Blob) {
        serializedBody = body as BodyInit;
      } else {
        serializedBody = JSON.stringify(body);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }
    }

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    // Set up timeout via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external signal if passed
    if (fetchInit.signal) {
      fetchInit.signal.addEventListener('abort', () => controller.abort());
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchInit,
        headers,
        body: serializedBody,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        if (fetchInit.signal?.aborted) {
          throw err;
        }
        throw ApiError.timeout();
      }
      throw ApiError.network(err instanceof Error ? err : undefined);
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle 401 Unauthorized with concurrency-safe refresh queue
    if (response.status === 401) {
      const isAuthEndpoint = path.includes('/auth/refresh') || path.includes('/auth/login');

      if (this.onUnauthorized && !isAuthEndpoint && !_isRetry) {
        let refreshedToken: string | null = null;
        try {
          // If a refresh is not already in-flight, initiate it
          if (!this.refreshPromise) {
            this.refreshPromise = this.onUnauthorized().finally(() => {
              this.refreshPromise = null;
            });
          }
          // Concurrent requests await the single ongoing refresh operation
          refreshedToken = await this.refreshPromise;
        } catch (refreshErr) {
          this.clearStoredTokens();
          if (this.onAuthExpired) {
            this.onAuthExpired();
          }
          throw refreshErr instanceof ApiError
            ? refreshErr
            : new ApiError(401, null, 'Session expired. Please log in.');
        }

        if (refreshedToken) {
          // Retry the original request exactly once with the refreshed token
          return this.request<T>(path, { ...options, token: refreshedToken, _isRetry: true });
        } else {
          // Refresh returned null (no valid refresh token or rejected)
          this.clearStoredTokens();
          if (this.onAuthExpired) {
            this.onAuthExpired();
          }
        }
      }
    }

    // Handle HTTP Error status codes
    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await response.json();
      } catch {
        try {
          errorBody = await response.text();
        } catch {
          errorBody = null;
        }
      }
      throw new ApiError(response.status, errorBody);
    }

    // 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    // Parse JSON
    try {
      return (await response.json()) as T;
    } catch {
      return null as T;
    }
  }

  public get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  public put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  public patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  public delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

// Export default singleton instance
export const apiClient = new ApiClient();
