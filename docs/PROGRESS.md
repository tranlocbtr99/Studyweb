# Progress
Updated: 2026-10-24
## Completed
- Two D1 schemas, Wrangler local migrations, secure auth, RBAC, CSRF and login throttling.
- Admin subject authoring and transactional audit migration; API CI passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40096715777
- Added focused admin authorization, origin, validation, creation and audit unit tests (new CI pending).
## Pending
- Verify new CI; add real local D1 integration tests for admin writes and duplicate slug handling.
- Topic/question/exam authoring, user provisioning, immutable grading snapshots, attempts/autosave/submit, frontend, load tests and deployment.
## Risks
- Unit mock checks SQL intent but does not prove D1 batch rollback; real integration test still required.
- No production deployment; 500 simultaneous users unverified.
## Next task
- Confirm CI and add local D1 integration tests for admin authoring.
