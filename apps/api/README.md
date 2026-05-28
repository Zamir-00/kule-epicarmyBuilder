# @kule/api

Backend API for Kule Army Builder. See [stage-2 design doc](../../docs/design/stage-2-backend-architecture.md).

## Quick start

```bash
npm install                                  # at the repo root
npm run dev --workspace apps/api             # starts the server on :3000
curl localhost:3000/healthz                  # → {"status":"ok"}
```

## Scripts

| Command | Effect |
|---|---|
| `npm run dev --workspace apps/api` | Fastify with watch-mode reload |
| `npm test --workspace apps/api` | Runs `node --test` |
| `npm run typecheck --workspace apps/api` | `tsc --noEmit` |
| `npm run build --workspace apps/api` | Compile to `dist/` |
| `npm run start --workspace apps/api` | Run the built output |

## Endpoints

### Static (proxies the legacy war/ directory)
- `GET /` → redirects to `/chooser.html` (war/index.html is a menu page, not a redirect)
- `GET /chooser.html`, `/js/**`, `/source-json/**`, `/lists/**`, etc. → serve the legacy UI

### Catalog API (new, with cache headers)
- `GET /data/source-json/<faction>.json` → cached JSON of the source-json file (`Cache-Control: public, max-age=300`)
- `GET /data/lists/<list>.json` → cached JSON of the list file (`Cache-Control: public, max-age=300`)
- `GET /data/factions` → JSON inventory: `[{slug, js_file, source_json, status}, ...]`

### Health
- `GET /healthz` → `{"status": "ok"}`

## What's here so far (S2.2)

- `@fastify/static` serving `war/` at `/`
- `/data/source-json/:file` and `/data/lists/:file` endpoints with Cache-Control and path-traversal guards
- `/data/factions` faction inventory (computed once per minute)
- Root redirect from `/` to `/chooser.html`
- 9 tests covering all surfaces

What's next: see open issues in [Milestone Stage 2](../../../../milestones/2).
