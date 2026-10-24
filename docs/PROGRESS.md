# Progress
Updated: 2026-10-24
## Completed
- D1 core/results, secure auth, admin subject/topic/question/exam/version authoring.
- Added admin exam item snapshot endpoint: verifies draft version, matching subject and A-D options; stores private answer separately and checks draft state in SQL; API CI pending.
## Pending
- Verify D1 negative-test CI and new API CI; test full HTTP-to-D1 integration, including atomic rollback.
- Content hash calculation, publishing, attempts/autosave/grading, frontend, load tests, deployment.
## Risks
- Snapshot endpoint has mocked unit tests only; no real D1 HTTP integration test yet.
- A concurrent publish requires stronger transaction-level guard; currently publish endpoint is not implemented.
- 500 concurrent users unverified; no production deployment.
## Next task
- Verify CI and strengthen snapshot integration tests before enabling publishing.
