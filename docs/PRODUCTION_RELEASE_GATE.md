# Production release gate — Studyweb

Status: NOT APPROVED FOR PUBLIC EXAMS (2026-10-24).

## Verified
- Remote Cloudflare D1 baseline migrations succeeded for exam_core and exam_results.
- Web build, API typecheck/tests and Wrangler dry-run succeeded in GitHub Actions.
- Same-origin static assets are configured in apps/api/wrangler.jsonc.

## Must complete before public release
1. Provision the first administrator and a test student using a secure, auditable bootstrap procedure; never put passwords or hashes in git.
2. Publish a real exam through the admin workflow and verify student catalog, login/logout, timer, autosave, recovery, submission and grading on deployed HTTPS origin.
3. Test concurrent save and duplicate submit, session expiration, CSRF, private answer-key exposure and access-control boundaries.
4. Load-test 100, then 500 concurrent exam takers against a staging environment; record response times, error rates and D1 usage. Do not assert 500-user capacity without evidence.
5. Confirm Cloudflare token has Workers Scripts Edit (D1 Edit alone cannot deploy), correct account ID, and production DNS/route ownership.
6. Create a recovery/rollback plan for Worker code and D1 backups. Do not re-run baseline migrations on initialized databases.
7. Approve production release only after all gates pass. Deploy with an explicit manual GitHub Actions trigger and verify /api/v1/health and the frontend.

## Current limitation
The existing deploy-beta workflow is a manual deployment mechanism, not proof of production readiness. It must not be used as a substitute for the gates above.
