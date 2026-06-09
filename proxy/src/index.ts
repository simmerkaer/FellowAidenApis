/**
 * Cloudflare Worker: a transparent CORS proxy for the Fellow Aiden API.
 *
 * The Fellow API is a mobile-app backend and does not send CORS headers, so a
 * browser cannot call it directly. This Worker forwards every request straight
 * through to the API, injects the Fellow `User-Agent` (browsers are not allowed
 * to set that header themselves), and adds permissive CORS headers to the
 * response so a browser-based client can use it.
 *
 * Point the library's `baseUrl` at this Worker's URL (without a trailing
 * `/v1` — the upstream base already includes it):
 *
 *   new FellowAiden({ email, password, baseUrl: 'https://<worker>.workers.dev' })
 */

const UPSTREAM = 'https://l8qtmnc692.execute-api.us-west-2.amazonaws.com/v1';
const FELLOW_USER_AGENT = 'Fellow/5 CFNetwork/1568.300.101 Darwin/24.2.0';

/** Cloudflare Rate Limiting binding (configured under [[ratelimits]]). */
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  /**
   * Optional comma-separated allowlist of origins. If unset, all origins are
   * reflected (handy for local dev / public demos). Set it in production to
   * lock the proxy to your own site.
   */
  ALLOWED_ORIGINS?: string;
  /** Per-IP limiter applied to every request. */
  RATE_LIMITER?: RateLimit;
  /** Stricter per-IP limiter applied only to POST /auth/login. */
  LOGIN_RATE_LIMITER?: RateLimit;
}

function tooMany(origin: string): Response {
  return new Response(JSON.stringify({ message: 'Rate limit exceeded. Try again shortly.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '60',
      ...corsHeaders(origin),
    },
  });
}

function resolveOrigin(requestOrigin: string | null, env: Env): string {
  const allow = env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (!allow || allow.length === 0) return requestOrigin ?? '*';
  if (requestOrigin && allow.includes(requestOrigin)) return requestOrigin;
  return allow[0]!;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = resolveOrigin(request.headers.get('Origin'), env);

    // Preflight — never rate-limited (browsers send it automatically).
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const incoming = new URL(request.url);

    // Per-IP rate limiting. Cloudflare provides the real client IP via
    // CF-Connecting-IP; fall back to a constant if absent (e.g. local dev).
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'local';
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
      if (!success) return tooMany(origin);
    }
    const isLogin = request.method === 'POST' && incoming.pathname.endsWith('/auth/login');
    if (isLogin && env.LOGIN_RATE_LIMITER) {
      const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: clientIp });
      if (!success) return tooMany(origin);
    }

    const target = UPSTREAM + incoming.pathname + incoming.search;

    // Forward the request, but force the Fellow User-Agent and drop hop-by-hop
    // / browser-managed headers that shouldn't be relayed.
    const headers = new Headers(request.headers);
    headers.set('User-Agent', FELLOW_USER_AGENT);
    headers.delete('Origin');
    headers.delete('Host');
    headers.delete('Referer');

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstreamResponse = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    });

    // Relay the response with CORS headers added.
    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const [key, value] of Object.entries(corsHeaders(origin))) {
      responseHeaders.set(key, value);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
