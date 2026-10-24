-- Confirm failed published-item insertion has not changed persisted state.
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-published-item-rejected',1,CASE WHEN
 (SELECT COUNT(*) FROM exam_items WHERE id='ci-rejected-published-item')=0
 AND (SELECT COUNT(*) FROM core_audit_logs WHERE target_id='ci-rejected-published-item')=0
 AND (SELECT status FROM exam_versions WHERE id='ci-version-1')='published'
 THEN 1 ELSE -1 END,1;
PRAGMA foreign_key_check;
