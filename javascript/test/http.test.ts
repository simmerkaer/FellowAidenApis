import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../src/http.js';
import { ApiError } from '../src/errors.js';

const jsonResponse = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function makeClient(
  fetchImpl: typeof globalThis.fetch,
  overrides: Partial<ConstructorParameters<typeof HttpClient>[0]> = {},
) {
  const reauthenticate = vi.fn(async () => {});
  let token: string | null = 'token-1';
  const client = new HttpClient({
    baseUrl: 'https://example.test/v1',
    userAgent: 'test-agent',
    getToken: () => token,
    reauthenticate: async () => {
      token = 'token-2';
      await reauthenticate();
    },
    retryDelayMs: 0,
    sleep: async () => {},
    fetch: fetchImpl,
    ...overrides,
  });
  return { client, reauthenticate, getToken: () => token };
}

describe('HttpClient', () => {
  it('sends auth + default headers and parses JSON', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
      expect((init!.headers as Record<string, string>)['User-Agent']).toBe('test-agent');
      return jsonResponse(200, { hello: 'world' });
    });
    const { client } = makeClient(fetchImpl as unknown as typeof globalThis.fetch);
    await expect(client.get('/thing')).resolves.toEqual({ hello: 'world' });
  });

  it('appends query parameters', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain('dataType=real');
      return jsonResponse(200, []);
    });
    const { client } = makeClient(fetchImpl as unknown as typeof globalThis.fetch);
    await client.get('/devices', { query: { dataType: 'real' } });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('retries transient 500s then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { e: 1 }))
      .mockResolvedValueOnce(jsonResponse(503, { e: 2 }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const { client } = makeClient(fetchImpl as unknown as typeof globalThis.fetch);
    await expect(client.get('/thing')).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('retries network errors then throws when exhausted', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const { client } = makeClient(fetchImpl as unknown as typeof globalThis.fetch, {
      maxRetries: 2,
    });
    await expect(client.get('/thing')).rejects.toThrow('ECONNRESET');
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('re-authenticates once on 401 then retries with the new token', async () => {
    const seenTokens: (string | null | undefined)[] = [];
    const fetchImpl = vi.fn(async (_url, init) => {
      const auth = (init!.headers as Record<string, string>).Authorization;
      seenTokens.push(auth);
      return auth === 'Bearer token-1' ? jsonResponse(401, { e: 'nope' }) : jsonResponse(200, { ok: true });
    });
    const { client, reauthenticate } = makeClient(fetchImpl as unknown as typeof globalThis.fetch);
    await expect(client.get('/thing')).resolves.toEqual({ ok: true });
    expect(reauthenticate).toHaveBeenCalledOnce();
    expect(seenTokens).toEqual(['Bearer token-1', 'Bearer token-2']);
  });

  it('throws ApiError with status and body on persistent non-2xx', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { message: 'bad' }));
    const { client } = makeClient(fetchImpl as unknown as typeof globalThis.fetch);
    const err = await client.post('/thing', { body: { a: 1 } }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ message: 'bad' });
  });

  it('returns null for an empty body', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }));
    const { client } = makeClient(fetchImpl as unknown as typeof globalThis.fetch);
    await expect(client.delete('/thing')).resolves.toBeNull();
  });
});
