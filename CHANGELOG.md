# Changelog
## 2026-10-25 — Authentication observation
- Fix parsing of multiline Wrangler tail JSON; add regression coverage.
- Correlate one live login with sanitized runtime telemetry; confirm production NotSupportedError at password verification, before session insertion.
## 2026-10-24 — Authentication diagnostics and registration
- Added student self-registration API and form with server-enforced student role and rate limits.
- Added negative registration security tests and sanitized authentication error logging.
- Added manual read-only remote D1 authentication diagnostic workflow; verified all required tables exist.
- Live login HTTP 503 remains unresolved; registration changes have not been deployed.
## 2026-10-24 — Student login UI
- Added email/password login, session status check, logout and conditional exam-room access.
## 2026-10-24 — Student web scaffold
- React/Vite exam room, manual save/recovery, submission and score display.
## 2026-10-24 — Student API
- Published exam reads, attempts, autosave, grading, result history.
## 2026-10-24 — Foundation
- D1, authentication, admin authoring and publication integrity.

## 2026-10-25 — Production PBKDF2 compatibility
- Identified HTTP 503 cause from live Worker log: `NotSupportedError` at password verification, due to production 100000 PBKDF2 iteration limit.
- Use 100000 iterations for new password records and protected administrator password reset; existing 310000 records require a controlled password reset/migration.
- Production rollout and real login verification pending.

## 2026-10-25 — Admin authoring and visual design
- Added administrator exam creation UI, question selection for draft assembly, and responsive pastel/glass styling inspired by the supplied design reference.
- Production deployment remains manual and requires CI success.

## 2026-10-25 — Admin dashboard navigation
- Separate overview, authoring, and exam workspaces; add responsive action cards without fake statistics.
