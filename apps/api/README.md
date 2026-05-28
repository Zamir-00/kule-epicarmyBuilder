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

## What's here so far (S2.1)

- Fastify skeleton with `/healthz` endpoint
- Env var parser (zod)
- One unit test

What's next: see open issues in [Milestone Stage 2](../../../../milestones/2).
