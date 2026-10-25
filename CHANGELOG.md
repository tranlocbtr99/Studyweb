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

## 2026-10-25 — LTStudy design foundation
- Responsive sidebar, student/admin navigation and pastel glass layout aligned to the supplied six-screen reference. Remaining screens tracked as work in progress.

## 2026-10-25 — Student dashboard
- Added pastel student hero, quick actions, and real exam-subject cards.

## 2026-10-25 — Attempt history cards
- Styled student attempt history and added current-page status summaries from real data.

## 2026-10-25 — Global user directory filtering
- Added server-backed account status/search/date ordering and total counts for accurate pagination; added refresh and count feedback.

## 2026-10-25 — API deployment-readiness repair
- Fixed undefined exam attempt duration variable that prevented API TypeScript compilation; duration is derived from the published exam version.

## 2026-10-25 — CI attempt-start fixture
- Updated the mock published exam version with its duration to reflect the duration-based attempt expiry API.

## 2026-10-25 — Admin overview KPIs
- Added real read-only administrator metrics endpoint and responsive overview cards for accounts, subjects, questions, exams and published versions.

## 2026-10-25 — Dashboard CI repair
- Fixed TypeScript variable initialization order for authenticated admin overview fetching.

## 2026-10-25 — Admin distribution visualization
- Added responsive, labeled bars comparing real subject, exam and question totals from the administrator overview API.

## 2026-10-25 — Subject detail repair and search
- Corrected the onClose callback type in SubjectDetail and added a search field for published exams by title.

## 2026-10-25 — Learning reader
- Search published lessons/materials with result counts; expand individual lessons for reading.
- Retry failed content loads and cancel obsolete requests on navigation.

## 2026-10-25 — Saved learning content management
- Paginated administrator lesson/material directory with reopen/edit and draft/publication controls.
- Validated, administrator-only, same-origin update API with audit records; no destructive data changes.

## 2026-10-25 — Learning content archive and recovery
- Filter saved lessons/materials by title and publication status across all pages.
- Archive content with confirmation; restore to draft, with administrator guards and audit records.

## 2026-10-25 — Learning editor workflow
- Preview lesson/material content and create editable draft copies of saved entries.
- Show character counts and unsaved-change prompts for editor replacement and browser reload/close.

## 2026-10-25 — Learning directory review
- Preview saved content in place, show update times/result ranges and clear search filters.
- Return focus to the editor when opening or copying saved content.


## 2026-10-25 — Reference UI and integrated exam workflow
- Unified responsive student/admin frame, course cards, SVG navigation, question bank/account tables and exam controls around the supplied LTStudy reference.
- Added student course discovery, administrator activity charts and paginated exam result reporting using database records.
- Fixed deadline finalization, retry identity/result reconciliation, active-exam navigation and stale directory requests.
- Added real SQLite integration coverage; 85 API tests, frontend build, typechecks and Worker package dry-run passed. Production deployment pending migration checks.

## 2026-10-25 — Submission control guard
- Disable answer clearing while final submission/recovery is in progress.

## 2026-10-25 — Learning progress and community
- Persist lesson completion per account and display actual progress on course cards; support additional lesson/material pages.
- Add course discussions with posting limits and recoverable administrator moderation.
- Add in-app announcements with administrator publishing/archive/restore and per-user unread/read state.
- Add an anonymous best-attempt leaderboard per published exam version.
- Add core community tables/results query index and SQLite integration coverage. All 95 tests, frontend build, typechecks and Worker packaging passed; production rollout pending.

## 2026-10-25 — Native D1 community checks
- Apply the new learning/community migrations and leaderboard index in local D1 CI and verify their write paths with SQL assertions.

## 2026-10-25 — Authorized release preparation
- Add idempotent existing-database upgrades with row/content preservation checks and SQLite tests.
- Add release fingerprints, recovery metadata, version verification and bounded live authentication smoke tests for the user-authorized deployment.

## 2026-10-25 — Deployment SQL argument repair
- Fix real Wrangler parsing of comment-leading migration SQL and cover it with a native CLI regression.
- Retry only read-only release fingerprint checks while deployment propagates.

## 2026-10-25 — Hosted release published
- Published frontend/API ea18fe4 and additive D1 upgrades to the existing LTStudy origin.
- Verified live student authentication, role/CSRF boundaries, assets and exact version; existing credentials/data preserved.


## 2026-10-25 — Subject-based exam imports and student removal
- Added administrator student removal and restoration, session revocation, protected staff accounts and retained learning/results history.
- Simplified subject creation to a name and added a unified manual or Word/PDF exam studio with answer review and separate publication.
- Added Workers AI document/question extraction, source grounding, explicit-answer checks, subject-filtered question banks, transactional imports and duplicate-question reuse.
- Added additive migration 0009, import/removal integration coverage and a synthetic live AI binding probe.


## 2026-10-26 — Hosted administrator acceptance
- Verified live secure administrator sign-in and AI extraction of Vietnamese DOCX and text PDF through browser uploads.
- Verified recoverable synthetic-student removal/restoration and original disabled-state preservation on the hosted UI.
- Passed 39 focused parser/API/integration checks. No application code or production exam content changed; uploaded QA content was not saved/published.


## 2026-10-26 — AI assistance for missing exam answers
- Add optional missing-answer suggestions with Vietnamese justification, visible AI provenance, qualitative confidence and administrator review.
- Preserve explicit source keys and abstain when context is insufficient or confidence low; never publish automatically.
- Recover parser-grounded questions omitted by extraction AI, protect option ordering and read Markdown headings/key tables.
- API typecheck, frontend build and 126 tests passed; production rollout pending.
