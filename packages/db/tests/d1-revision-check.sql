-- Check revision increments for inserted snapshots and changes.
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-item-revision',1,CASE WHEN
 (SELECT items_revision FROM exam_versions WHERE id='ci-version-2')=1
 THEN 1 ELSE -1 END,1;
UPDATE exam_items SET position=position WHERE id='ci-snapshot-item';
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-item-revision-update',1,CASE WHEN
 (SELECT items_revision FROM exam_versions WHERE id='ci-version-2')=2
 THEN 1 ELSE -1 END,1;
