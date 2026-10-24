# Progress
Updated: 2026-10-24
## Completed
- Core/results D1, auth/RBAC/CSRF, admin subject/topic/question/exam authoring and draft version creation.
- Exam version API CI passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097406337
- Identified D1 smoke failure as expected immutable-version trigger rejection; separated negative test into expected-failure CI step; verification pending.
## Pending
- Verify D1 version CI; attach question snapshots, private keys and content hash; guarded publishing.
- Real HTTP-to-D1 integration/rollback tests, attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- SQL smoke tests do not validate HTTP batch rollback or concurrent version numbering.
- 500 concurrent users unverified; no production deployment.
## Next task
- Verify D1 CI then implement safe snapshot assembly.
