# Testing strategy
Bootstrap acceptance: inspect Git tree for required docs and placeholder directories, check internal consistency, confirm existing README unchanged and no secrets committed. No runtime test claim for docs-only bootstrap.
Future targeted tests: Vitest for Zod schemas, grading, deadline and version conflicts; Playwright for login/exam/resume/submit and answer visibility; D1 integration tests for migrations and idempotency; k6 staged 100/250/500 virtual users with realistic autosave intervals. Record p95 latency, failure rate, D1 write volume, and Cloudflare plan limits. Do not certify 500 concurrent users without evidence.
CI will run typecheck, targeted tests and build; deployment must be gated by passing checks and approval. No CI workflow installed yet.
