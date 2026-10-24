# API v1 contract — proposed, not implemented
All routes /api/v1, Hono + Zod. Secure HttpOnly Secure SameSite session cookies, hashed session tokens, server-side RBAC and CSRF protection for cookie-authenticated writes. Standard errors: {error:{code,message,requestId}}. Validate body size and rate limits.
POST /auth/login; POST /auth/logout; GET /me.
GET /subjects; GET /exams; GET /exams/:id; POST /attempts {examVersionId} -> {attemptId,expiresAt,saveVersion,questions:[{id,options:[{id,text}]}]}; question and option IDs stable despite shuffle. Never return answer keys.
GET /attempts/:id -> latest acknowledged snapshot and saveVersion (authorized owner only).
PUT /attempts/:id/snapshot {expectedVersion,answers:[{questionId,optionIds}],clientMutationId} -> {saveVersion,savedAt}; on stale version HTTP 409 {error:{code:'VERSION_CONFLICT',...},current:{saveVersion,answers}}. Client must reconcile, not blindly overwrite. Save only dirty snapshots, roughly 60-second cadence with jitter; local storage cannot be treated as server confirmation.
POST /attempts/:id/submit {idempotencyKey,expectedVersion,answers} -> {receiptId,status,submittedAt,resultAvailable}; server validates ownership, deadline and immutable grading reference, then atomically stores final snapshot, status, score and receipt in exam_results. Retries return identical persisted receipt. If commit fails, return retryable error, never success.
GET /attempts/:id/result -> released grade and optionally explanations only according to publication policy.
Admin routes: subjects/topics/questions/options CRUD, exams, draft versions, publish/revoke, CSV/Excel import (future; authenticated, audited, validated). No editing published snapshots.
Timeout/expiry handling, scoring tie rules, stale submissions and grading-snapshot provisioning require explicit integration tests before production.
