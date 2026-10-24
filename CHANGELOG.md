# Changelog
## 2026-10-24 — Guarded publish API (pre-production)
- Added admin-only publish endpoint that validates snapshots, computes SHA-256, checks draft status and item count, updates publication state and records audit. Concurrent same-count edits remain a risk pending integration tests.
## 2026-10-24 — Exam integrity digest
- Canonical SHA-256 over question snapshots and private marking keys; CI passed.
## 2026-10-24 — D1 snapshot verification
- D1 private-key separation smoke tests passed.
## 2026-10-24 — Foundation
- Two D1 databases, authentication, admin authoring and CI.
