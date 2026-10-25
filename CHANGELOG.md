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

## 2026-10-25 — Persisted question bank
- Added admin-only paginated question search endpoint and frontend search/selection for previously saved questions.

## 2026-10-25 — Resume authoring
- Added administrator-only subject/topic catalogs and selectors to reuse existing course structure after reload.

## 2026-10-25 — Reopen draft exams
- Added admin-only saved exam/version listing and draft reopening with persisted question positions.

## 2026-10-25 — Draft question editing
- Added protected editing of draft question bank entries and UI forms, without changing published exam snapshots.

## 2026-10-25 — Admin security tests
- Added regression tests for admin-only question editing, CSRF, validation and published snapshot preservation.

## 2026-10-25 — Exam publication integrity tests
- Added nine regression cases for invalid exam structures, answer-key isolation and deterministic content hashing.

## 2026-10-25 — Draft question review
- Added admin-only exam item listing and draft question review in the authoring UI, without exposing answer keys.

## 2026-10-25 — Draft exam item management
- Administrators can reorder and remove draft exam questions without modifying published versions.

## 2026-10-25 — Single-question exam interface
- Added one-question-at-a-time student exam UI, question navigation grid, answered indicators and progress count.

## 2026-10-25 — Review flagged questions
- Student exams now support marking questions for review, restoring flags in the same browser session, and jumping to flagged questions.

## 2026-10-25 — Pre-submit review
- Added an unanswered-question review and explicit confirmation before submitting a student exam.

## 2026-10-25 — Student exam usability batch
- Search/filter published exam catalog; completion progress meter; unanswered navigation and clear-answer control.

## 2026-10-25 — Batch: exam duration and student history
- Configurable 5–240-minute exam duration with backward-compatible 90-minute default, enforced by API and displayed in both interfaces.
- Paginated student attempt history with status and score summaries.
