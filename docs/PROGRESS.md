# Progress
Updated: 2026-10-24
## Completed
- D1 core/results, secure auth and admin exam authoring.
- Local D1 snapshot and database checks passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097742030
- Added deterministic SHA-256 digest helper over public question snapshots AND private answer keys; rejects empty, gapped and malformed versions. API CI pending.
## Pending
- Verify digest CI; integrate digest with guarded publishing and D1 atomicity checks.
- Attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- Digest helper is not yet connected to a publishing endpoint; published versions remain unavailable through the API.
- HTTP-to-D1 rollback and 500-user concurrency are unverified; no production deployment.
## Next task
- Verify digest CI, then implement guarded publish transaction with current D1 snapshot validation.
