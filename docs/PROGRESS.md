# Progress
Updated: 2026-10-24
## Completed
- Core/results D1, authentication, admin question/exam/version authoring and draft item API.
- Added real local D1 SQL snapshot smoke test for four options and separation of private answers; new D1 CI pending.
## Pending
- Verify snapshot D1 and API CI; HTTP-to-D1 batch rollback tests; content hash and guarded publishing.
- Attempts/autosave/grading, frontend, load tests, deployment.
## Risks
- SQL smoke does not yet execute the HTTP endpoint or validate atomic rollback.
- 500 concurrent users unverified; no production deployment.
## Next task
- Verify CI and build real API-to-D1 integration coverage.
