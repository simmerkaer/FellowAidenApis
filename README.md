# Fellow Aiden APIs

Client libraries for the [Fellow Aiden](https://fellowproducts.com/) coffee
brewer's cloud API, in multiple languages, plus a live browser demo. Inspired
by the Python library [`9b/fellow-aiden`](https://github.com/9b/fellow-aiden).

## Repository layout

| Folder | What it is | Status |
| --- | --- | --- |
| [`javascript/`](./javascript) | TypeScript/JavaScript client library | ✅ Available |
| [`proxy/`](./proxy) | Cloudflare Worker CORS proxy (for the browser demo) | ✅ Available |
| [`demo/`](./demo) | Vite single-page demo that uses the library in the browser | ✅ Available |
| `dotnet/` | .NET client library | 🛠 Planned |

## Try it locally (no hosting needed)

Read your real profiles from the command line:

```sh
cd javascript
npm install
cp .env.example .env      # then edit .env with your Fellow login
npm run demo
```

This runs entirely in Node, so there's no CORS issue and credentials stay on
your machine.

## Why the demo needs a proxy

The Fellow API is a mobile-app backend and sends **no CORS headers**, so a
browser cannot call it directly (a preflight returns `403`). The demo therefore
routes through a tiny Cloudflare Worker that forwards requests, injects the
Fellow `User-Agent` (browsers can't set it), and adds CORS headers:

```
browser (demo on GitHub Pages)  ──►  Cloudflare Worker (proxy/)  ──►  Fellow API
```

The proxy never stores or logs credentials — it only relays.

## Hosting the demo

1. **Deploy the proxy** (one-time):
   ```sh
   cd proxy
   npm install
   npx wrangler login
   npm run deploy        # → https://fellow-aiden-proxy.<subdomain>.workers.dev
   ```
   Optionally set `ALLOWED_ORIGINS` in `proxy/wrangler.toml` to your Pages
   origin to lock it down.

2. **Enable GitHub Pages**: repo Settings → Pages → Source = "GitHub Actions".

3. **Point the demo at your proxy**: repo Settings → Secrets and variables →
   Actions → Variables → add `VITE_PROXY_URL` = your Worker URL.

4. **Push to `main`** — [`deploy-demo.yml`](./.github/workflows/deploy-demo.yml)
   builds the library + demo and publishes to Pages. (The proxy URL can also
   just be typed into the demo's form at runtime.)

### Running it as a public demo

The demo is built so any visitor can enter their own Fellow credentials and see
the library work — it's **read-only** (lists profiles/schedules, changes
nothing) and stores no credentials. If you host it publicly, be aware that:

- **You're running a credential relay.** The Worker forwards visitors' logins to
  Fellow. Set `ALLOWED_ORIGINS` in `proxy/wrangler.toml` to your Pages origin so
  only your demo can use it, and consider Cloudflare rate limiting to deter abuse.
- **Visitors are trusting you** with their password in transit. The proxy never
  logs or stores it, and the Advanced panel lets cautious users point at their
  own Worker instead — but make the read-only, nothing-stored guarantees clear
  (the demo UI already states them).

## License

The JavaScript library is MIT. This is an unofficial project, not affiliated
with or endorsed by Fellow.
