# Progress
Updated: 2026-10-24
## Completed
- Core/results D1, auth, admin authoring, exam snapshots and integrity SHA-256.
- Publish API added in pre-production; CI typecheck failed because D1 batch result was typed unknown; corrected explicit result cast, verification pending.
## Pending
- Verify API CI; build real D1 publication integration tests and address concurrent same-count edits before production.
- Student attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- Publishing read/write race remains; do not deploy publishing until addressed.
- No 500-user load test or production deployment.
## Next task
- Verify API CI and implement transaction-safe publication guards.
