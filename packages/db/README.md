# @studyweb/db
Two independent D1 SQLite schemas with Drizzle table definitions and forward-only SQL migrations.
Run locally (not executed in this commit): `npm install`, `npm run typecheck`, `npm test` inside packages/db.
Apply each migration only to its matching database after backup and review. Never apply results SQL to core or vice versa. These SQL files are initial migration sources; production database IDs, bindings and deploy scripts are deliberately not configured.
Drizzle TypeScript schema is the typed mapping; SQL migrations also enforce CHECK constraints and immutability triggers. Future schema changes must update both and include migration tests. Do not generate destructive migrations blindly.
