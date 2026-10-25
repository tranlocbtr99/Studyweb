# Studyweb progress
Updated: 2026-10-24

## Verified completed
- Remote Cloudflare D1 migrations and initial administrator provisioning succeeded.
- Public Worker and web UI deployed at https://studyweb-api.tranlocbtr99.workers.dev.
- Login, student self-registration, and sanitized error logging code deployed successfully (deployment run 40110360791).
- Remote D1 read-only auth schema diagnostic succeeded (run 40107481906): users, roles, user_roles, sessions and login_rate_limits exist.
- Existing administrator password reset succeeded (run 40109428739); do not reset it again without evidence.

- Independent live HTTP probe run 40112023101: health=200, subjects D1 read=200, malformed login=400, duplicate admin registration=409. All checks passed.
- Independent live HTTP probe run 40112116955: real administrator login returned HTTP 503 AUTH_UNAVAILABLE; other four boundary checks passed. This reproduces the failure outside the browser.

- Independent live HTTP probe run 40112499097: unknown-user login=401 INVALID_CREDENTIALS (rate limiter and user lookup succeed for that request); real admin login=503 AUTH_UNAVAILABLE; duplicate registration=429 due registration rate limit. Workflow correctly failed due one unexpected status.

- CI run 40114122560 (API checks) and 40114122527 (deployment readiness) passed on commit 916f134; PBKDF2 hash/verify roundtrip test passed in Node test runtime, not yet confirmed in deployed Cloudflare runtime.

- Isolated Cloudflare Workers local-runtime PBKDF2 test run 40114669470 succeeded: HTTP 200, 310000 iterations, 32 ms measured in that run. This rules out a basic lack of PBKDF2 support in local workerd, but not production CPU limits, password mismatch or session-write failure.

- Remote D1 session-integrity workflow 40115045183 passed: PRAGMA foreign_key_check returned no violations, orphan_sessions=0, active_admins=1, session_insert_triggers=0, session_indexes=3. This is read-only structural evidence, not proof that live session INSERT succeeds.

## Confirmed blocker
- User reports admin login HTTP 503 and student registration HTTP 503. Admin login also returned 429 after repeated attempts; login rate limit counts every attempt.
- Three live Cloudflare tail diagnostic runs (40110478403, 40110801089, 40111385415) succeeded as GitHub jobs but did NOT produce usable application logs.
- In the latest run, parser read 5 JSON values, 0 recognized HTTP responses and 0 console entries; all event shapes were unrecognized. User confirmed attempting login during an earlier capture window.
- Thus tail instrumentation is NOT a reliable observation source yet; neither a Worker CPU fault nor D1 failure has been proven.
- Do not ask user to repeat identical tail/login tests. Investigate Cloudflare tail protocol and/or Worker invocation metrics with a distinct, validated diagnostic method before changing authentication security settings.

## Not yet verified
- Live end-to-end admin login, student registration and student login.
- Load testing at 100–500 concurrent students.
- Complete admin authoring/results UI and recovery/rollback/backup.

## Next task
- Investigate production login's exact failure stage with trusted runtime telemetry. Local PBKDF2 and mocked session INSERT passed; D1 schema and integrity checks passed. Do not conclude production session INSERT succeeds without a real write-path test. Do not claim either is the cause without stage-level evidence.
- Stop repeating the same live login probe; a different diagnostic is required. Avoid extra login attempts that consume rate-limit budget.
- Preserve data, passwords and existing published exam versions.

## 2026-10-25 authentication investigation
- Reproduced a diagnostic defect with pretty-printed multiline Wrangler JSON: the previous line-oriented parser discarded envelopes and parsed nested scalars as unrelated events.
- Fixed envelope buffering; existing fixtures and a multiline regression both pass.
- Correlated diagnostic workflow captures one administrator login during a 60-second tail window and prints only allowlisted categories/statuses. No passwords or raw log bodies are printed; no data/password reset or application deployment.
- Authentication root cause remains unconfirmed pending correlated production telemetry.

## Confirmed production failure stage (2026-10-25)
- Correlated run 40115464366 captured two live POST failures with `password_verification` / `NotSupportedError`, HTTP 503; JSON envelopes now parse correctly (2 HTTP responses, 2 console entries).
- This locates the observed administrator failure before session insertion. Current password code requests 310000 PBKDF2 iterations, matching Cloudflare's documented workerd issue #1346 about the production 100000-iteration ceiling. The exact exception message was deliberately not printed.
- No authentication algorithm, password, user record, or deployed application was changed in this investigation.
- Next repair must preserve existing credentials: changing only the creation iteration count cannot verify existing 310000-iteration records. Verify a compatible implementation on deployed Workers before migration or release.

## Root cause and pending rollout (2026-10-25)
- Production Worker log directly identified login failure stage `password_verification`, exception `NotSupportedError`, HTTP 503. Cloudflare production PBKDF2 caps each derive call at 100000 iterations, while existing Studyweb records use 310000. Local workerd did not enforce this limit.
- Updated new password hashes and admin reset script to 100000 iterations; tests must pass and Worker must be deployed before login can work.
- Existing 310000-iteration admin hash is NOT automatically compatible: run protected existing-admin reset workflow after deploying compatible code; this revokes existing admin sessions but does not delete users or exams. Do not claim production fixed until real login succeeds.

## Admin authoring UI and visual design (2026-10-25)
- Added admin-only authoring panel using existing protected endpoints for subjects, topics, questions, exams, draft versions, question assignment and publishing.
- Captures created question IDs for a selection control; no manual UUID entry required for questions created in the current session.
- Introduced responsive pastel/glass CSS inspired by user-provided LTStudy reference. This is a first styling pass, not a complete reproduction of its sidebar/dashboard/course screens.
- Web CI and deployment readiness must pass before manual deploy. Production still serves previous deployment until explicitly published.

## Admin dashboard navigation (2026-10-25)
- Manual production deployment run 40117845200 succeeded for the first authoring UI and pastel design.
- Added separate admin overview, authoring, and student exam navigation. Overview cards are action links, not fabricated analytics.
- Responsive dashboard styling added. Await Web checks and deployment readiness before next manual production rollout.

## Persisted question bank (2026-10-25)
- Added admin-protected GET /api/v1/admin/questions with bounded search, offset/limit pagination and draft option details. This endpoint is never mounted for student access.
- Admin editor can search persisted questions and select them for exam assembly. New frontend and backend CI are pending; production not deployed.
- Editing existing questions, subject/topic browse, draft resume and end-to-end production authoring verification remain outstanding.

## Resume subject/topic authoring (2026-10-25)
- Added protected GET /api/v1/admin/subjects and /topics?subjectId=... (bounded to 500 rows each) and UI selectors for existing subjects/topics after reload.
- Existing question bank search and admin dashboard checks passed; new subject/topic API and UI checks pending. Production remains on prior manually deployed revision.
- Draft exam resume, editing and full authoring E2E tests are future work.

## Draft exam reopening (2026-10-25)
- Added protected GET /api/v1/admin/exams listing saved exams and their versions, including question counts; admin editor can reopen a draft and continue at its persisted item count.
- Existing subject/topic API and web checks passed. New draft-listing CI pending. Production not deployed; still requires manual rollout.
- The list is capped at 200 rows; question editing, draft item removal, full pagination and E2E authoring remain future work.

## Draft question editing (2026-10-25)
- Added admin-only PUT /api/v1/admin/questions/:id with strict validation, same-origin protection, audit trail and draft-only status gate.
- Question bank now exposes editing body, four options, answer key and explanation. Existing exam item snapshots are not rewritten, preserving published content.
- API and Web CI are pending; production rollout not performed. Next: API tests for authorization/immutability and end-to-end authoring flow.

## Admin edit security regression tests (2026-10-25)
- Added API regression coverage for session and role guards, cross-origin edit rejection, invalid option count, draft-only editing, and non-mutation of exam item snapshots.
- Test workflow 40118934848 is pending; no production deployment initiated.

## Exam integrity regression coverage (2026-10-25)
- Added nine automated tests for empty exams, missing/duplicate positions, incomplete options, accidental answer-key exposure, invalid answer keys, deterministic ordering, and hash changes for public/private content edits.
- Tests target existing server-side examContentHash validation; no production data or schema changed. API CI 40158373119 pending. Deployment not initiated.

## Draft exam question review (2026-10-25)
- Added admin-only GET /api/v1/admin/exam-versions/:id/items to retrieve ordered public question snapshots without private answer keys.
- Authoring UI can display and refresh saved draft questions after reopening an exam. Removal/reordering remain pending.
- Per user preference, focus upcoming turns on features; consolidate extensive integration tests near release. Existing CI still runs automatically. No production deploy.

## Draft exam item management (2026-10-25)
- Added admin-only DELETE /exam-items/:id and PATCH /exam-items/:id/move for draft versions, with audit logs and transactional position updates.
- Admin UI offers move up/down and remove actions with confirmation; refreshes ordered items from D1.
- Feature-first development as requested. CI runs automatically; comprehensive integration testing deferred until feature-complete. Production not deployed.

## Student one-question exam flow (2026-10-25)
- Replaced the all-at-once exam question display with a single-question interface, previous/next controls, numbered navigation, answered-state indicators and live answered count.
- Existing attempt autosave, recovery, time limit and server-side submission remain unchanged; answers remain keyed by question position.
- Feature-first work as requested; comprehensive E2E validation deferred until feature-complete. Production not deployed.

## Review flags for student exams (2026-10-25)
- Added ReviewFlags component and integrated it into one-question student exam flow.
- Students can mark/unmark the current question and jump among marked questions. Flags persist in sessionStorage keyed by attempt ID and are separate from graded answers.
- Full integration testing deferred as requested; no production deployment.

## Pre-submission unanswered question review (2026-10-25)
- Student exam submission now opens an inline confirmation panel listing unanswered questions and a direct link back to each unanswered item.
- Submission still uses the existing server-side save-before-submit and idempotent submission flow; no API or database changes.
- Per user request, extensive testing deferred until feature-complete. No production deployment.

## Student exam usability batch (2026-10-25)
- Added exam catalog text search, subject filter, selection highlighting and empty-filter state.
- Added answered progress bar, unanswered-only navigation filter, jump to first unanswered question, and clear-answer control.
- Changes confined to web UI and styling; existing server-side scoring, autosave, and immutable published versions unchanged.
- Comprehensive tests deferred until feature-complete as requested; no production deployment.

## Batch feature implementation (2026-10-25)
- Added additive EXAM_CORE migration 0006 for per-exam-version duration (5–240 minutes, existing 90-minute default).
- Admin can set duration when creating a draft and update duration before publication; duration appears in saved exam listings.
- Student catalog and exam header show the configured duration. Server sets attempt expiry using the published version's duration instead of a global constant.
- Student dashboard now has paginated personal attempt history, statuses, dates and scores using the existing authorized /attempts endpoint.
- Development remains feature-first at user's request. Migrations not applied to production; integration tests and deployment pending.

## LTStudy screenshot-aligned UI foundation (2026-10-25)
- Introduced a responsive desktop sidebar and content frame for authenticated student/admin views, pastel glass styling, consistent navigation, and refreshed exam choice surfaces.
- Reference image covers six target screens; remaining course lessons, user-management and real analytics screens require separate backed features. No fabricated dashboard metrics.
- This is a visual foundation, not pixel-perfect completion. Integrated visual and functional testing deferred until feature completion; no production deploy.

## User directory UI refinements (2026-10-25)
- Added current-page account status filter and registration-date sorting to the admin user directory.
- Filters operate on the currently loaded page only; global filtering and real-time analytics remain pending. No production deployment or integration verification.

## Student dashboard (2026-10-25)
- Student home now has LTStudy-style hero, exam catalog count, quick actions (catalog, history, resume), and subject cards derived from actual published exam catalog.
- Course tiles represent subjects with published exams, not lesson-progress records; no fabricated completion metrics.
- Visual and functional integration verification deferred to final consolidation; not deployed.

## Attempt history visual improvement (2026-10-25)
- Added three live current-page counters (attempts, submitted, active) and styled attempt history entries as cards.
- Counts explicitly describe the loaded page rather than global platform totals. No production deployment or completed integration tests.

## Global user directory filtering (2026-10-25)
- Admin user directory now supports server-side status filtering, email search, stable date sorting, exact matching-account count and paginated navigation across the complete user table.
- UI sends filters to the API and provides refresh and visible result count. Read-only user management; no permission or account status mutations.
- Changes committed; integrated validation and production deployment pending.

## Deployment readiness TypeScript repair (2026-10-25)
- Exam start response previously referenced undefined attemptDurationSeconds, blocking API typecheck in workflow run 40162966050.
- Define attemptDurationSeconds from published exam version duration_minutes, and use consistently for persisted expires_at and response expiresAt.
- No migration or data changes; awaiting fresh GitHub Actions verification before any deployment.

## CI attempt-start fixture repair (2026-10-25)
- Latest deployment readiness API typecheck passed after attemptDurationSeconds fix, but one attempt-start test failed because its mock published exam version omitted durationMinutes.
- Updated fixture to include durationMinutes=90, matching expected 5400-second expiry; production logic unchanged. Await new CI run; do not deploy before checks pass.

## Admin overview KPIs (2026-10-25)
- Verified API checks and deployment readiness succeeded for attempt-start test fixture commit a6e4ad1.
- Added admin-only read-only /overview endpoint aggregating counts of users, subjects, questions, exams and published versions from EXAM_CORE.
- Admin overview UI fetches those counts and displays responsive pastel metric cards. No invented activity charts or course completion numbers.
- Awaiting CI for the new changes; not deployed.

## Admin dashboard CI repair (2026-10-25)
- API checks and deployment readiness passed for the new read-only overview endpoint at d4719e6.
- Web checks failed for dashboard App.tsx because overview useEffect referenced signedIn before its declaration (TS2448/TS2454).
- Moved signedIn state declaration above the effect; pending next CI run. No production deployment.

## Admin distribution visualization (2026-10-25)
- Web checks and deployment readiness succeeded after the admin dashboard declaration-order repair (commit 35e6890).
- Added responsive distribution bars for subjects, exams, and questions using real counts from the protected overview API; values and scales are labeled and no fabricated analytics are shown.
- No production deployment. New changes await CI. Subject breakdown API expansion remains pending.

## Student subject detail (2026-10-25)
- Admin distribution visualization passed Web checks and deployment readiness at commit 98b9248.
- Student course cards now open a subject detail panel with four tabs: exams, lessons, materials, discussion.
- Exam tab lists real published catalog entries and lets students select a version for the existing exam flow. Other tabs explicitly state unavailable content; no fabricated lesson progress or discussions.
- Responsive subject detail styles added. New changes await CI; no production deployment.

## Subject detail CI repair and exam search (2026-10-25)
- Subject detail initially failed web typecheck with TS1110 due to missing void in onClose callback type; corrected the type.
- Added local case-insensitive title search of actual published exams within subject detail, with clear no-match state and responsive search field.
- CI verification for these changes remains pending; no production deployment.

## Learning content MVP (2026-10-25)
- Added migration 0007 for subject lessons and HTTPS materials.
- Added authenticated published-content reads and administrator content creation.
- Added student lesson/material views and administrator creation form.
- Apply migration 0007 before deploying API. CI and deployment pending.

## Learning reader usability (2026-10-25)
- Added title/body search for published lessons and title/description search for materials, with matching counts and explicit empty results.
- Lessons expand individually using native keyboard-accessible details; preserve line breaks and wrap long content on narrow screens.
- Added retry for failed content requests, abort on navigation, and cleared previous subject content/search when switching subjects.
- No schema changes. Comprehensive integration/visual verification deferred as requested; CI pending and production not deployed. Migration 0007 remains a prerequisite for learning API deployment.

## Saved learning content management (2026-10-25)
- Added protected administrator lesson/material listing by subject and kind, 20 entries per page with matching total.
- Added same-origin protected updates with schema validation, subject-bound IDs, missing-content errors and transactional audit records.
- Administrator UI can reopen saved content, edit text/links/lesson order and switch between draft/published; refreshes list after save.
- Locked subject/type during editing and disabled form during save to prevent accidental cross-content changes. No delete or migration added.
- Relevant guards/types reviewed against existing Env; automated CI pending. Comprehensive integration/visual tests deferred as requested. Not deployed; migration 0007 still required.

## Learning content lifecycle (2026-10-25)
- Previous commit 4694196 passed Web checks, API checks and deployment readiness.
- Added server-side title search and status filters to the paginated learning directory, including accurate matching totals.
- Added protected archive/restore transitions with transactional audits; restore always produces a draft. UI confirms each transition and refreshes results.
- Local SQLite transition/conditional-audit checks passed, including missing-row no-audit behavior. New TypeScript/API/Web CI pending; final integration tests deferred.
- No production deployment or data deletion. Migration 0007 remains required for production learning content.
