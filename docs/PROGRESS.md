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
- Diagnose why wrangler tail JSON is not parsed as expected without printing raw sensitive events. Validate parser with fixtures representing actual Cloudflare output.
- If tail cannot be validated, use Cloudflare invocation/observability API or a safe, isolated read-only Worker health/D1 diagnostic.
- Preserve data, passwords and existing published exam versions.
