# Progress
Updated: 2026-10-24
## Completed
- D1 core/results schemas, secure auth/RBAC/CSRF, admin subjects/topics/questions.
- Question SQL integrity checks passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097247663
- Added admin-only exam container creation with subject validation and audit; API CI pending.
## Pending
- Verify API CI; create immutable version snapshots and secure publish workflow.
- Real HTTP-to-D1 integration tests, user provisioning, attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- Creating an exam container does not publish a usable exam version.
- No production deployment; 500 concurrent users unverified.
## Next task
- Verify CI and implement immutable draft exam version creation and publish safeguards.
