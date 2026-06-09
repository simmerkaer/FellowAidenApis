# fellow-aiden live demo

A tiny Vite single-page app that uses the [`fellow-aiden`](../javascript)
library **in the browser** to log in and list your brewer's profiles and
schedules.

Because the Fellow API has no CORS support, the browser can't call it directly.
This demo talks to the [Cloudflare Worker proxy](../proxy) instead, which
relays to Fellow and adds CORS headers.

```
browser (this app)  ──►  Cloudflare Worker proxy  ──►  Fellow API
```

## Run locally

1. Build the library (the demo imports it via `file:../javascript`):
   ```sh
   cd ../javascript && npm install && npm run build
   ```
2. Start the proxy (in another terminal):
   ```sh
   cd ../proxy && npm install && npm run dev    # http://localhost:8787
   ```
3. Start the demo:
   ```sh
   npm install && npm run dev
   ```
4. Open the demo, enter `http://localhost:8787` as the proxy URL plus your
   Fellow credentials.

## Configure the proxy URL

The proxy URL is entered in the UI and remembered in `localStorage`. To
pre-fill it at build time, set `VITE_PROXY_URL` (e.g. in CI, as a repo
variable) to your deployed Worker URL.

## Deploy

Pushed automatically to GitHub Pages by
[`.github/workflows/deploy-demo.yml`](../.github/workflows/deploy-demo.yml).
See the [root README](../README.md#hosting-the-demo) for one-time setup.

This demo is meant to be public: any visitor can enter their own Fellow
credentials and watch the library work. It's **read-only** and stores no
credentials. Because the proxy relays real logins, keep `ALLOWED_ORIGINS` set to
your Pages origin and see the [root README](../README.md#running-it-as-a-public-demo)
for the hosting caveats.
