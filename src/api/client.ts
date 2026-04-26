import { request } from 'undici';
import { ApiError } from './errors.js';

export type ClientOpts = { baseUrl: string; token?: string };

export class ApiClient {
  constructor(private opts: ClientOpts) {}

  async get<T = unknown>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    return this.req<T>('GET', path, undefined, query);
  }
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.req<T>('POST', path, body);
  }
  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.req<T>('PATCH', path, body);
  }

  private async req<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
    query?: Record<string, string | undefined>,
  ): Promise<T> {
    const url = new URL(path, this.opts.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.opts.token) headers['Authorization'] = `Bearer ${this.opts.token}`;

    const res = await request(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.body.text();
    const json = text ? safeJson(text) : undefined;

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return json as T;
    }

    const message =
      (json && typeof json === 'object' && 'message' in json && typeof json.message === 'string')
        ? json.message
        : `HTTP ${res.statusCode}`;
    const details =
      (json && typeof json === 'object' && 'errors' in json) ? (json as Record<string, unknown>).errors : json;
    throw new ApiError(res.statusCode, message, details);
  }
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
