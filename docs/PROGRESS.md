# Progress
Updated: 2026-10-24
## Completed
- D1 core/results, authentication, admin authoring and immutable published exams.
- Student public exam read, attempt start, versioned autosave and recovery; previous API checks passed.
- Added server-graded submission with save-version guard, time cutoff, D1 transactional score/receipt writes and same-key idempotent replay; CI pending.
## Pending
- Student results history, frontend and end-to-end/load testing; deployment.
- Full D1 transactional concurrency/rollback integration to be tested at milestone.
## Risks
- Submission scoring uses one point per question; exam-specific grading policies not yet supported.
- Start-attempt retries may duplicate attempts; add start idempotency.
- 90-minute duration temporary; 500-user concurrency unverified; no production deployment.
## Next task
- Add student results and attempt history read API, then milestone integration checks.
