# Changelog
## 2026-10-24 — Login/logout and CSRF
- Added PBKDF2 password verification, secure session cookie issuance, hashed session storage and logout revocation.
- Enforced Origin matching for state-changing authentication routes and added security tests.
- Production login rate limiting and account provisioning remain pending.
## 2026-10-24 — Session auth
- Added session validation and RBAC guards; CI checks passed.
## 2026-10-24 — API
- Added Hono read-only endpoints; CI passed.
## 2026-10-24 — Database
- Added two D1 migrations and passing CI.
