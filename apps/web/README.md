# @kule/web

Frontend SPA for Kule Army Builder. See [stage-3 design](../../docs/design/stage-3-frontend.md).

## Quick start

```bash
# From repo root, in two terminals:
npm run dev --workspace apps/api    # backend on :3000
npm run dev --workspace apps/web    # this app on :5173 with HMR

# Browse to http://localhost:5173
```

The Vite dev server proxies `/api/trpc/*`, `/data/*`, and `/sign-in` to the backend so cross-origin isn't a concern in dev.

## Scripts

| Command | Effect |
|---|---|
| `npm run dev --workspace apps/web` | Vite dev server + HMR |
| `npm run build --workspace apps/web` | tsc + vite build → dist/ |
| `npm run typecheck --workspace apps/web` | `tsc --noEmit` |
| `npm run preview --workspace apps/web` | Preview the production build locally |

## What's here so far (S3.1)

- Vite + React 18 + TypeScript
- Tailwind CSS configured with CSS-variable theme + dark mode support
- Minimal shadcn-style Button component (more added per subsequent stories)

What's next: see open issues in [Milestone Stage 3](../../../../milestones/3).
