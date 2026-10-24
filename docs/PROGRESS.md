# Progress
Updated: 2026-10-24
## Completed
- Core/results D1, auth, admin authoring and guarded published versions.
- Student published exam read API CI passed (1669c5f).
- Added student attempt start endpoint: authenticated, CSRF-protected, published-only, verifies SHA-256 content, stores private grading snapshot in EXAM_RESULTS and returns 90-minute timing metadata; focused tests added.
## Pending
- Autosave with optimistic version, idempotent submit/server grading, results history, frontend, load tests and deployment.
- Defer full regression and HTTP-to-D1 integration to milestone; preserve targeted security checks.
## Risks
- Attempt start currently creates a new attempt for each request; client retries may duplicate attempts until idempotency is added.
- 90-minute duration is a temporary default pending exam configuration.
- 500-user capacity unverified; no production deployment.
## Next task
- Implement versioned autosave with ownership and expiry checks.
