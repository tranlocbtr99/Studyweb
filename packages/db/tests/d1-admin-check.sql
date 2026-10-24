-- Local D1 admin write / audit and duplicate slug integrity smoke test.
-- D1 manages foreign key enforcement; do not toggle this pragma.
INSERT INTO users(id,email,password_hash,status,created_at)
VALUES('ci-admin','ci-admin@example.test','not-a-real-password','active',1);
INSERT INTO subjects(id,slug,title) VALUES('ci-admin-subject','ci-admin-subject','Admin subject');
INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at)
VALUES('ci-admin-audit','ci-admin','subject.created','ci-admin-subject',1);
-- Fail the script if either the subject or audit row is absent.
CREATE TEMP TABLE admin_assertion(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO admin_assertion(ok)
SELECT CASE WHEN (SELECT COUNT(*) FROM subjects WHERE id='ci-admin-subject')=1
 AND (SELECT COUNT(*) FROM core_audit_logs WHERE target_id='ci-admin-subject' AND actor_id='ci-admin')=1
 THEN 1 ELSE 0 END;
-- Duplicate slug must be rejected; IGNORE means no second row can be inserted.
INSERT OR IGNORE INTO subjects(id,slug,title)
VALUES('ci-duplicate','ci-admin-subject','Duplicate subject');
INSERT INTO admin_assertion(ok)
SELECT CASE WHEN (SELECT COUNT(*) FROM subjects WHERE slug='ci-admin-subject')=1
 AND (SELECT COUNT(*) FROM subjects WHERE id='ci-duplicate')=0
 THEN 1 ELSE 0 END;
PRAGMA foreign_key_check;
