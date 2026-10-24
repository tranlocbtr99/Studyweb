# Studyweb beta: initialize Cloudflare D1

The two D1 databases must already exist and be empty:
- `exam_core` — `2cb0dbe3-3421-4a6e-9c71-e64d6451647e`
- `exam_results` — `873c72e9-318d-4d91-b1f3-b9d07cf18aad`

Run these commands from the repository root in a trusted terminal after authenticating Wrangler (`npx wrangler login`). Each command is forward-only and targets a specific database by its name. Stop immediately if any command fails. Never rerun an initial migration on a database that already has tables.

```bash
npx wrangler d1 execute exam_core --remote --file=packages/db/migrations/core/0001_initial.sql
npx wrangler d1 execute exam_core --remote --file=packages/db/migrations/core/0002_login_rate_limits.sql
npx wrangler d1 execute exam_core --remote --file=packages/db/migrations/core/0003_admin_audit.sql
npx wrangler d1 execute exam_core --remote --file=packages/db/migrations/core/0004_question_drafts.sql
npx wrangler d1 execute exam_core --remote --file=packages/db/migrations/core/0005_exam_item_revisions.sql
npx wrangler d1 execute exam_results --remote --file=packages/db/migrations/results/0001_initial.sql
```

Verify both schemas:

```bash
npx wrangler d1 execute exam_core --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
npx wrangler d1 execute exam_results --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Do not deploy to production yet. Next gates: verify migration results, configure a single-origin frontend/API deployment, test auth and full attempt lifecycle, then deploy beta. Do not commit tokens or passwords.
