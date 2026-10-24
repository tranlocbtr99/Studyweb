-- Local D1 smoke test: persistent assertion table avoids forbidden TEMP schema operations.
INSERT INTO users(id,email,password_hash,status,created_at)
VALUES('ci-admin','ci-admin@example.test','not-a-real-password','active',1);
INSERT INTO subjects(id,slug,title)
VALUES('ci-admin-subject','ci-admin-subject','Admin subject');
INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at)
VALUES('ci-admin-audit','ci-admin','subject.created','ci-admin-subject',1);
-- Force a constraint error if either row is missing.
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-admin-assert',1,
 CASE WHEN (SELECT COUNT(*) FROM subjects WHERE id='ci-admin-subject')=1
 AND (SELECT COUNT(*) FROM core_audit_logs WHERE target_id='ci-admin-subject' AND actor_id='ci-admin')=1
 THEN 1 ELSE -1 END,1;
-- A duplicate slug must not create another subject.
INSERT OR IGNORE INTO subjects(id,slug,title)
VALUES('ci-duplicate','ci-admin-subject','Duplicate subject');
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-unique-assert',1,
 CASE WHEN (SELECT COUNT(*) FROM subjects WHERE slug='ci-admin-subject')=1
 AND (SELECT COUNT(*) FROM subjects WHERE id='ci-duplicate')=0
 THEN 1 ELSE -1 END,1;
PRAGMA foreign_key_check;
