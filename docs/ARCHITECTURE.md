# Architecture (planned; not deployed)
Monorepo: apps/web (React + TypeScript strict + Vite + Tailwind + shadcn/ui), apps/api (Cloudflare Workers + Hono + Zod), packages/db (Drizzle + D1 migrations), packages/shared (shared contracts), tests/load (k6), tests/e2e (Playwright).
Cloudflare Pages hosts static UI; /api routes go to Workers. D1 is source of truth. R2 is optional for uploaded assets; never store answer keys in public assets. GitHub Actions will run checks before approved deployments.
Modules (future): identity/roles; question bank; exam authoring and immutable publication snapshots; attempts/autosave; grading/results; analytics; admin.
Load target 100–500 concurrent examinees is a design goal, not a verified capacity. Avoid per-keystroke writes: debounce/batch saves, use optimistic concurrency and retry/backoff, index frequent queries, paginate admin reads. Validate D1 quotas and perform k6 load testing before release; free-tier sufficiency is unproven.
No infrastructure provisioned in bootstrap.
