# Fellow Aiden API proxy (Cloudflare Worker)

The Fellow API is a mobile-app backend with no CORS support, so browsers can't
call it directly. This Worker is a thin pass-through that:

- forwards every request to the Fellow API,
- injects the Fellow `User-Agent` header (browsers can't set it themselves),
- handles `OPTIONS` preflight and adds CORS headers to responses.

It does **not** store, log, or inspect credentials — it only relays.

## Run locally

```sh
npm install
npm run dev        # serves on http://localhost:8787
```

Point the demo (or library) at `http://localhost:8787` as its `baseUrl`.

## Deploy

```sh
npx wrangler login     # one-time, opens a browser
npm run deploy         # deploys to https://fellow-aiden-proxy.<your-subdomain>.workers.dev
```

Lock it to your site by setting `ALLOWED_ORIGINS` in `wrangler.toml` to your
GitHub Pages origin (e.g. `https://<you>.github.io`) before deploying.

## Rate limiting

Two per-IP limiters are configured in `wrangler.toml` (Cloudflare Rate Limiting
API):

- `RATE_LIMITER` — 60 requests / 60s across all paths (caps general abuse).
- `LOGIN_RATE_LIMITER` — 8 requests / 60s on `POST /auth/login` (deters
  credential stuffing). Over-limit requests get `429`.

> **Local dev caveat:** `wrangler dev` recognizes the bindings but does **not**
> enforce the limits — `.limit()` always returns `success: true` locally.
> Enforcement happens at the Cloudflare edge once deployed (or with
> `wrangler dev --remote`). Tune the numbers to taste.

## Security note

This proxy relays real Fellow logins. Keep `ALLOWED_ORIGINS` set to your own
demo site so other websites can't use it, rely on the rate limits above to
deter brute force, and make the read-only / nothing-stored guarantees clear in
the UI (the demo already does).
