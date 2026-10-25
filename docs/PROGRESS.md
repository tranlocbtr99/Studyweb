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

## Learning editor preview and duplication (2026-10-25)
- Commit 5bce0d8 passed Web, API and deployment readiness checks.
- Added plain-text student-content preview with safe HTTPS material links and body character counts.
- Added copy-to-editor action for existing content; copies are unsaved drafts until explicitly saved, leaving originals untouched.
- Added dirty-state prompts before replacing/cancelling editor content, changing subject/type, or archiving the edited item; beforeunload warns on browser reload/close where supported.
- Does not persist local drafts or intercept parent application navigation. Comprehensive integration/visual tests remain deferred; new CI pending and no production deployment.

## Learning directory review workflow (2026-10-25)
- Previous commit 5b518ce passed Web checks and deployment readiness.
- Added inline saved-content previews, safe HTTPS material links, Vietnamese update timestamps and visible result ranges.
- Added clear-filters action. Editing or copying scrolls back to the editor and focuses the title field while preserving unsaved-change confirmation.
- Previewing list entries does not replace the editor buffer or change publication state. No API/schema changes or production deployment.
- New CI pending; complete integration/visual verification remains deferred until feature completion.


## Screenshot-aligned application and integration review (2026-10-25)
- Reworked the application frame, SVG icons, pastel/glass surfaces, landscape-style hero, course cards, question bank table, account role badges, exam options and numbered navigation to follow the supplied 4584.png reference. Added responsive bottom navigation and reduced-motion support.
- Separated student home/courses/exams/history and administrator overview/learning/question authoring/exams/users/results workspaces. Admin exam navigation now opens authoring instead of a student room. Student catalogs load after authentication; course listing includes published lessons/materials without requiring an exam.
- Added protected administrator analytics (real 7-day attempts, attempt statuses, recent audit activity) and paginated results joined to core account/exam labels. No fabricated traffic, growth or course-completion percentages.
- Improved exam selection to load directly, guarded changing exams/leaving an active attempt, froze answer edits during submission and reused the attempt UUID for submission retries. Failed responses now query the authoritative result before reporting failure.
- Fixed expired attempts being impossible to finalize: answer writes remain closed at deadline; finalization grades only the pre-deadline persisted snapshot. Automatic deadline submission and manual retry are available.
- Fixed stale user-directory responses overwriting newer filter results; added actual role labels. Removed the inactive discussion tab from student course navigation.
- Validation: production frontend build and API strict typecheck passed; all 85 API tests passed, including 9 real SQLite integration cases for learning visibility, permissions, archive/restore audits, expired saves/finalization, receipt replay, results and analytics. Worker dry-run packaged static assets and D1 bindings successfully.
- Browser QA with isolated synthetic fixtures verified student navigation/course/lesson views, selecting/starting an exam, answering/marking/changing question, pre-submit review, submitted score, administrator overview/users/question table. Desktop viewport 1348px had no document horizontal overflow. Temporary fixtures were removed and production Vite configuration restored before final build. Mobile CSS is implemented; mobile viewport was not exercised in this browser.
- No production data changes or deployment. Migrations 0006/0007 must be checked/applied before production rollout. Live authentication, production E2E and 100–500 concurrent-user load remain unverified. Persistent lesson-completion progress, discussion, ranking, notifications and account-role/status mutation are not implemented; no such controls are presented as working features.

## Final submission control guard (2026-10-25)
- Commit 2bee27d passed GitHub Web checks, API checks and deployment readiness.
- Also disable clear-answer while submission/recovery is busy so the visible answer cannot change during finalization. No API/schema change or production deployment.

## Persistent learning and community features (2026-10-25)
- Added additive core migration 0008 for per-user lesson progress, discussion posts, announcements and per-user read receipts; results migration 0002 adds the leaderboard query index. No existing user/exam/attempt records are rewritten or deleted.
- Lesson completion/incompletion persists by authenticated user, appears on real course cards and is restored when reopening content. Student content supports loading additional pages of 100 lessons/materials and uses selected subject IDs to avoid mixing equal course titles.
- Added subject discussion with plain-text rendering, 20-post pagination, five-post/minute per-user write limit and administrator hide/restore moderation with audit records.
- Added administrator announcement creation/archive/restore and student per-account read state/unread count. These are in-app announcements only; no emails or push notifications are sent.
- Added top-50 per-published-version leaderboard: one best attempt per student, ties by submission time, anonymous aliases and own-row indication; emails and raw account IDs are omitted.
- Browser QA used the actual bundled Hono API with isolated in-memory SQLite seeded test accounts/content: verified marking a lesson complete and updating course cards, creating/reading discussion, unread-to-read transition, administrator announcement publication, moderation hide/restore control, and selecting a version to render its ranking. Fixed an ambiguous created_at column found in the moderator query and added its integration assertion.
- Validation: frontend production build, API typecheck, all 95 tests (including 19 real SQLite integration cases) and Worker dry-run passed. QA-only authentication injection and middleware are not in the source commit or production build.
- Production remains unchanged. Required migration checks/applications before rollout: core 0006/0007/0008 and results 0002. Live authentication, deployed E2E, mobile browser validation and load at 100–500 concurrent users remain unverified. Account-role/status mutations remain outside this community feature batch.

## Native D1 community CI coverage (2026-10-25)
- Community feature commit eb18f41 passed Web, API, database and deployment-readiness CI.
- Extended the local D1 workflow beyond its previous core-0005 baseline to apply core 0006/0007/0008 and results 0002, with native D1 assertions for progress/read-receipt upserts, moderation and query index presence.
- This workflow uses local ephemeral D1 only. No production migrations or deployment.

## Authorized deployment preparation (2026-10-25)
- User explicitly requested completion and deployment to the existing Cloudflare origin.
- Added a bounded, restart-safe upgrade for initialized D1 databases. It validates baseline/community schemas, preserves existing counts and published version fields, retains the existing credential records, and refuses to initialize an empty/unknown database.
- Added four native SQLite upgrade tests for nonempty upgrade, rerun preservation and incompatible/unknown schema refusal.
- Added a one-release workflow retaining the existing beta-deployment environment and deployment concurrency lock. It accepts only a release-marker-only commit whose parent is the reviewed source.
- Workflow records D1 Time Travel bookmarks/previous Worker metadata, verifies/tests/builds before mutation, upgrades additive schemas, stamps frontend/API with the exact commit, deploys and runs live registration/login/read/CSRF/role/logout checks.
- Live checks create only a unique synthetic student and disable it/revoke its sessions afterwards. Existing accounts/passwords and exam content are never reset. Worker rollback is attempted if post-deploy verification fails; D1 is never automatically rewound over newer user activity.
- Not deployed yet in this preparation commit. Capacity at 100–500 simultaneous exam takers is not certified.

## Confirmed CLI migration argument defect and repair (2026-10-25)
- Release run 40204198375 stopped before publication while passing the comment-leading core-0006 SQL as a separate --command argument.
- Reproduced with the real Wrangler CLI: it interprets the leading SQL comment as an unknown command-line argument. The ALTER never reached D1; baseline schema validation and recovery metadata capture had already succeeded.
- Pass SQL using the single --command=SQL argument and add a real local Wrangler regression preserving an existing row/default duration. All five upgrade tests passed.
- Live fingerprint reads now retry within a bounded propagation window; registration/writes are never automatically retried.
- Existing production Worker and credentials remain unchanged pending the repaired release run.

## Hosted release verified (2026-10-25)
- Release run 40204738861 succeeded at https://studyweb-api.tranlocbtr99.workers.dev/.
- Live frontend/API fingerprint: ea18fe4517ab1b8aa1df787818d9e98a7edd0b3f. Cloudflare Worker version: ec62de4e-a6f2-40ce-867c-1344ef65ac58.
- Remote core 0006/0007/0008 and results 0002 upgrade verified; baseline row counts and all existing published exam fields retained. Existing password records were not reset.
- Release validation passed 95 API tests plus five upgrade/real-Wrangler tests, typechecks, frontend build and Worker packaging.
- Live HTTPS checks passed exact API/frontend versions, static assets, registration, student login/session-cookie protections, authenticated student/course/community reads, administrator isolation, cross-origin rejection and logout.
- The unique synthetic student was disabled and its sessions revoked. No exam attempts/content or existing user data were created/rewritten by the live smoke tests.
- Independently opened the hosted page in the browser: LTStudy title, completed login UI and exact release meta match; desktop document width equals viewport width.
- Remaining acceptance boundaries: 100–500 concurrent-candidate load, mobile viewport QA and owner-admin/full live exam-authoring E2E are not certified. Recovery metadata is retained with the successful release run.


## Student removal and subject-based exam imports (2026-10-25)
- Administrators can remove student-only accounts from the active directory, revoke sessions and block login. Removed accounts can be restored; original disabled status, results and learning history are retained. Administrator/teacher accounts and self-removal are protected.
- Subject creation accepts a name and generates its internal slug. Learning authoring accepts a subject name. Exam authoring selects an existing subject, accepts manual questions or DOCX/PDF files, and provides editable review before draft save and separate publication.
- Workers AI extracts existing questions; grounded source text and explicit answer keys are required. Missing answers require administrator review. Documents are limited to 10 MB, text to 180,000 characters and exams to 200 questions; legacy .doc must be saved as .docx. Scanned documents depend on the conversion service.
- Imports atomically create exam drafts and subject question-bank entries, with idempotency receipts and subject-scoped deduplication. Editing bank content does not mutate published exam snapshots.
- Validation: API typecheck and 115 tests passed; production frontend build passed; five nonempty upgrade/native Wrangler checks passed. Migration 0009 adds recoverable-removal columns and import metadata. Release includes an isolated actual Workers AI extraction/conversion probe before production changes.
- Browser visual review of this update was blocked by the browser URL security policy; no workaround attempted. Full interactive file-upload E2E remains unverified. Deployment pending source CI and release checks.

### Hosted import/removal release verification
- Source c30c944 passed API, Web, Database, native D1 migration and deployment-readiness workflows. AI probe propagation/cleanup fix 8ed4a7 followed; release 185b6a4df5b0cfe921ea2d0cbd35cc12df876ade deployed successfully in Actions run 40209987458.
- Live Worker version: 524ee9a3-bfb5-4d1c-b905-e6be729c69e8. URL: https://studyweb-api.tranlocbtr99.workers.dev/.
- Verified actual Workers AI extraction and document conversion on an isolated synthetic Worker; both current and abandoned probe Workers were removed. Migration 0009 applied without decreasing existing row counts or changing published exam content.
- Live frontend/API fingerprints and assets matched the release. Real registration/login, student reads, admin isolation, CSRF and logout passed. Synthetic QA account was disabled and sessions revoked afterward.
- All 115 API tests and five upgrade/native Wrangler checks passed again in release. Actual DOCX extraction preserved Vietnamese question/option/answer text in a synthetic fixture. Complete browser upload/admin-authoring E2E remains unverified because browser URL policy blocked preview access; owner credentials were not used. Existing concurrent-user load acceptance remains outstanding.


## Live administrator browser acceptance (2026-10-26, Asia/Ho_Chi_Minh)
- Independently confirmed release run 40209987458 completed successfully, including actual AI/document conversion, additive D1 upgrade, publication and authenticated live checks.
- Owner authenticated through the secure browser credential flow; administrator navigation and live directory loaded successfully.
- Uploaded synthetic Vietnamese DOCX and text PDF through the actual hosted file chooser. Both produced the expected question, all four Vietnamese options and explicit answer B with AI success status. Selecting existing subject Toán and acknowledging review enabled the draft/bank save action.
- Exercised recoverable removal on the existing synthetic release smoke-test student only: directory count 5 to 4, removed-directory count 1; restored it and confirmed count 5 and its original disabled status. No real student account was removed and no password was reset.
- Re-ran focused API/integration/parser checks: 39/39 passed. These cover subject-name creation, atomic draft/bank import, per-subject deduplication, missing-answer rejection and removal protections.
- Synthetic uploaded questions were not saved or published to production. Thus the hosted save/publication click path remains outside this browser verification; persistence has automated real-SQL coverage. Scanned-PDF/OCR, long real-world files and 100–500 concurrent candidates are not certified by these checks.


## Missing-answer AI assistance (2026-10-26)
- Added a separate admin/session/origin-protected, rate-limited answer-suggestion endpoint. It solves only missing answers, preserves supplied keys, returns concise Vietnamese justifications and qualitative self-assessed confidence, and abstains for low-confidence or unjustified output. Duplicate/out-of-range indices and invalid answer labels cannot silently replace answers.
- Exam Studio can automatically suggest missing answers after document extraction, or explicitly analyze missing answers in a manually entered/parsed exam. Administrator review remains mandatory; proposed answers and explanations carry an AI label through saved explanations. Inference never directly publishes an exam.
- Improved extraction recovery: parser-grounded questions omitted by AI are retained, reordered options cannot inherit source keys, Markdown headings and simple Markdown answer-key tables are parsed. Full-document keys are applied before solving, including keys in a later chunk. AI failure preserves extracted/partially solved content.
- Validation before rollout: API typecheck, 126 tests and frontend production build passed. Temporary no-database Workers AI probe now additionally verifies a synthetic missing-answer arithmetic question. No schema migration or published-exam rewrite required.
- Pending production release and live missing-answer browser acceptance. Confidence is not calibrated probability; no external factual/source verification is claimed.


### Hosted missing-answer release and browser acceptance
- Source bfcb705317b2e4a66dde6655eed40c7c2a64677d passed API/Web/deployment-readiness CI. Release 064e8968dd8811cc2d181214ebc1f1aa9edc7f5a succeeded in run 40224556493, including actual Workers AI missing-answer solving, database-preservation checks, publication and authenticated live verification.
- In the existing securely authenticated owner-admin browser, uploaded a synthetic Vietnamese DOCX containing three cases. Explicit source answer B was preserved. A missing arithmetic answer was proposed as A with concise Vietnamese rationale, visible AI provenance and administrator-review label. A question referencing an absent chart was left unanswered with a missing-chart explanation.
- Review confirmation remained unchecked and save stayed disabled while the chart question lacked an answer. No synthetic exam/question was saved or published to production. Production capacity/OCR accuracy on arbitrary real-world documents and factual correctness across all subjects are not certified by this small acceptance fixture.
