# Architecture decision log
## ADR-001: Fixed platform (2026-10-24)
Accepted: React/TS/Vite/Tailwind/shadcn UI; Cloudflare Pages/Workers/Hono/Zod/D1/Drizzle; optional R2; GitHub Actions/Vitest/Playwright/k6. Rationale: edge hosting and modular implementation. Reconsider only with measured technical evidence.
## ADR-002: Data correctness (2026-10-24)
Accepted: server-side scoring and deadlines; no early answer disclosure; immutable published exam versions; optimistic versioned autosave; idempotent submission; forward-only migration discipline.
## ADR-003: Deployment boundary (2026-10-24)
Accepted: bootstrap is documentation and directories only. No account provisioning, billing, production deployment, or unmeasured free-tier claims.
