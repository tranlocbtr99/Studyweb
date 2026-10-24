# Progress
Updated: 2026-10-24
## Completed
- Core/results D1, auth/RBAC/CSRF, admin subject/topic/question/exam authoring.
- Empty draft exam versions API passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40097406337
- Added local D1 SQL tests for sequential version numbering and published-version content protection; new CI pending.
## Pending
- Verify D1 version integrity CI; build safe exam question snapshots, content hash and guarded publishing.
- HTTP-to-D1 rollback tests, user provisioning, attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- Version SQL test does not prove concurrent allocation or full API transaction behavior.
- Draft versions contain no questions and are not publishable; 500 concurrent users unverified.
## Next task
- Verify D1 version CI and implement secure exam item snapshot assembly.
