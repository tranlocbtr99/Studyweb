# Architecture decisions
## ADR-001 — Stack (accepted 2026-10-24)
React + TypeScript strict + Vite, Tailwind, shadcn/ui, Cloudflare Pages/Workers, Hono, Zod, Drizzle, D1, optional R2, GitHub Actions, Vitest, Playwright, k6. Mobile-first.
## ADR-002 — Two D1 databases (accepted 2026-10-24)
exam_core contains identities, catalog and immutable published exams; exam_results contains attempts, snapshots, scores and audit. Cross-database transactions and foreign keys do not exist: use application verification, immutable version identifiers/digests and a single-database atomic submission receipt+score.
## ADR-003 — Write efficiency and integrity (accepted 2026-10-24)
Serve questions once without answer keys. Local answers, dirty-only ~60-second jittered snapshot saves, optimistic versioning, bounded retries and server-authoritative deadlines. One snapshot row per attempt; durable server confirmation; idempotent grading and submit. Preserve historical data on upgrades.
## ADR-004 — Capacity and spending (accepted 2026-10-24)
100–500 concurrent users is a test target, not a guarantee. Prefer free tier, no paid provisioning without approval, budget alerts at 70% of verified limits, load tests and recovery drills before production.
