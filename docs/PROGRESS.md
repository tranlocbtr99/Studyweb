# Progress
Updated: 2026-10-24
## Completed
- D1 core/results, admin authoring, snapshots and SHA-256.
- Added additive exam item revision migration, D1 SQL revision tests and optimistic publication revision guard. CI pending.
## Pending
- Verify API/D1 CI and test publish transaction with real HTTP-to-D1 integration.
- Attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- Optimistic revision check detects concurrent writes but HTTP-to-D1 transaction and rollback are not yet proven.
- 500 simultaneous users unverified; no production deployment.
## Next task
- Verify revision CI, test publication conflict and rollback end-to-end.
