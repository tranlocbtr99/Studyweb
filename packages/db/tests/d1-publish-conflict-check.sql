-- Simulate a stale publisher which read revision 1 while another writer
-- has already updated an exam item, advancing the revision to 2.
UPDATE exam_versions
SET content_hash='stale-digest',published_at=100,status='published'
WHERE id='ci-version-2' AND status='draft' AND published_at IS NULL
 AND items_revision=1
 AND (SELECT COUNT(*) FROM exam_items WHERE exam_version_id='ci-version-2')=1;
-- No publication or digest update may occur after a revision conflict.
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-publish-stale-rejected',1,CASE WHEN
 (SELECT status FROM exam_versions WHERE id='ci-version-2')='draft'
 AND (SELECT published_at FROM exam_versions WHERE id='ci-version-2') IS NULL
 AND (SELECT content_hash FROM exam_versions WHERE id='ci-version-2')=''
 AND (SELECT items_revision FROM exam_versions WHERE id='ci-version-2')=2
 THEN 1 ELSE -1 END,1;
-- The current revision is accepted; only one publication transition is possible.
UPDATE exam_versions
SET content_hash='current-digest',published_at=101,status='published'
WHERE id='ci-version-2' AND status='draft' AND published_at IS NULL
 AND items_revision=2
 AND (SELECT COUNT(*) FROM exam_items WHERE exam_version_id='ci-version-2')=1;
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-publish-current-accepted',1,CASE WHEN
 (SELECT status FROM exam_versions WHERE id='ci-version-2')='published'
 AND (SELECT content_hash FROM exam_versions WHERE id='ci-version-2')='current-digest'
 THEN 1 ELSE -1 END,1;
UPDATE exam_versions
SET content_hash='replay-digest',published_at=102,status='published'
WHERE id='ci-version-2' AND status='draft' AND published_at IS NULL
 AND items_revision=2;
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-publish-replay-rejected',1,CASE WHEN
 (SELECT content_hash FROM exam_versions WHERE id='ci-version-2')='current-digest'
 AND (SELECT published_at FROM exam_versions WHERE id='ci-version-2')=101
 THEN 1 ELSE -1 END,1;
