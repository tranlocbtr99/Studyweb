# LTStudy release verification — 2026-10-25

The user explicitly authorized updating the existing hosted LTStudy application. Hosting origin and audience remain unchanged.

## Release procedure
- Build and verify the reviewed source before changing the existing databases.
- A release-marker-only commit points to its reviewed parent. The release workflow validates that relationship and retains the existing beta-deployment environment protection and concurrency lock.
- Record D1 Time Travel bookmarks and previous Worker metadata.
- Run the bounded additive upgrader against initialized core/results databases. Never rerun baseline initialization, reset passwords or rewrite published exam snapshots.
- Publish a frontend/API pair carrying the same exact release commit.
- Verify HTTPS assets, registration/login/session cookie, student reads, administrator access isolation, CSRF and logout. Disable the unique synthetic test student and revoke its sessions.
- If live verification fails after publishing, roll back Worker code to the recorded single previous version. Keep additive schema changes; do not restore D1 over concurrent user activity automatically.

## Verification boundary
Source/SQLite/native D1 tests and bundle checks have passed for the community feature release. The release job must still succeed and its actual live version must be checked before claiming deployment.
A successful deployment is not certification for 100–500 concurrent examination candidates. Staging load verification and live owner-admin/full examination authoring verification remain separate acceptance items.
