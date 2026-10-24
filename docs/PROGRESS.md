# Progress
Updated: 2026-10-24
## Completed
- Core/results D1 schemas, auth/RBAC/CSRF, admin subject authoring and API CI.
- D1 admin smoke check added; corrected unsupported PRAGMA foreign_keys=ON in Wrangler D1 execute script; CI pending.
## Pending
- Confirm D1 CI; add request-to-D1 integration tests and transaction rollback checks.
- Topics/questions/exams, provisioning, attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- D1 smoke checks do not prove HTTP endpoint or rollback semantics.
- No production deployment; 500 concurrent users unverified.
## Next task
- Verify corrected D1 CI, then implement topic authoring.
