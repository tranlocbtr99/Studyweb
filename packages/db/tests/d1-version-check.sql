-- Exercise SQL-side draft version allocation and published-version guards.
INSERT INTO exams(id,subject_id,title)
VALUES('ci-version-exam','ci-admin-subject','Version integrity exam');
INSERT INTO exam_versions(id,exam_id,version_number,content_hash,status)
SELECT 'ci-version-1','ci-version-exam',COALESCE(MAX(version_number),0)+1,'','draft'
FROM exam_versions WHERE exam_id='ci-version-exam';
INSERT INTO exam_versions(id,exam_id,version_number,content_hash,status)
SELECT 'ci-version-2','ci-version-exam',COALESCE(MAX(version_number),0)+1,'','draft'
FROM exam_versions WHERE exam_id='ci-version-exam';
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-version-numbering',1,
CASE WHEN (SELECT version_number FROM exam_versions WHERE id='ci-version-1')=1
 AND (SELECT version_number FROM exam_versions WHERE id='ci-version-2')=2
 AND (SELECT COUNT(*) FROM exam_versions WHERE exam_id='ci-version-exam')=2
 THEN 1 ELSE -1 END,1;
-- A published version cannot be deleted or have its immutable fields edited.
UPDATE exam_versions SET content_hash='fixed-content-hash',published_at=1,status='published'
WHERE id='ci-version-1';
UPDATE OR IGNORE exam_versions SET content_hash='tampered' WHERE id='ci-version-1';
DELETE FROM exam_versions WHERE id='ci-version-1' AND published_at IS NULL;
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-version-immutable',1,
CASE WHEN (SELECT content_hash FROM exam_versions WHERE id='ci-version-1')='fixed-content-hash'
 AND (SELECT status FROM exam_versions WHERE id='ci-version-1')='published'
 THEN 1 ELSE -1 END,1;
PRAGMA foreign_key_check;
