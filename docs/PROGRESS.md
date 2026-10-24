# Progress
Updated: 2026-10-24
## Completed
- Core/results D1, auth, admin authoring and SHA-256 publication guard.
- API checks for zero-row insert correction passed (e2421c9).
- Added real D1 negative test for inserting into published exam versions and follow-up state/audit assertion; CI pending.
## Pending
- Verify D1 CI and implement HTTP-to-real-D1 transaction rollback/audit integration coverage.
- Student attempts/autosave/grading, frontend, load tests and deployment.
## Risks
- This negative SQL test does not prove multi-statement batch rollback through HTTP.
- 500 simultaneous users unverified; no production deployment.
## Next task
- Verify D1 CI and implement real HTTP-to-D1 batch rollback integration.
