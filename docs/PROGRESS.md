# Progress
Updated: 2026-10-24
## Completed
- Architecture and database modules with initial SQL migrations and Drizzle mapping.
- Database CI passed: https://github.com/tranlocbtr99/Studyweb/actions/runs/40095401958
- API scaffold: Hono/TypeScript, health, public subjects and exam metadata, safe error handling, API CI workflow and route tests.
## Pending
- Verify API CI and Cloudflare D1 migrations.
- Authentication, RBAC, CSRF, admin authoring, trusted immutable grading snapshots, attempts, autosave, atomic submit/score, analytics, frontend, load tests, deployment and backup.
## Security
- No mutation endpoints enabled until authentication and grading integrity are implemented.
- Answer keys remain server-only.
## Risks
- 500 concurrent users not load-tested. Free-tier quotas unverified. No production deployment.
## Next task
- Confirm API CI, then implement authenticated session handling and permissions with targeted tests.
## Relevant files
- apps/api/src/index.ts; apps/api/tests/routes.test.ts; apps/api/wrangler.jsonc; .github/workflows/api-checks.yml.
