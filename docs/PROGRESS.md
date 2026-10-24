# Progress
Updated: 2026-10-24
## Completed
- Core/results D1 schemas, auth/RBAC/CSRF, admin subjects/topics; API CI passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097002178
- Diagnosed D1 smoke failure as unsupported CREATE TEMP TABLE in Wrangler local D1; replaced temporary assertion table with existing constrained login_rate_limits table; new D1 CI pending.
## Pending
- Verify D1 CI, full request-to-D1 integration tests and rollback behavior.
- Questions/options/exams, provisioning, attempts/autosave/grading, frontend, load tests, deployment.
## Risks
- Smoke SQL tests constraints but not HTTP integration; 500 concurrent users unverified.
## Next task
- Verify corrected D1 CI, then question draft authoring.
