-- Verify a real D1 draft exam snapshot and private answer payload.
INSERT INTO exam_items(id,exam_version_id,position,question_snapshot_json,answer_key_private_json)
SELECT 'ci-snapshot-item',id,0,
 json_object('questionId','ci-question','body',(SELECT body FROM question_drafts WHERE question_id='ci-question'),
 'options',(SELECT json_group_array(json_object('label',stable_option_id,'text',body))
 FROM (SELECT stable_option_id,body FROM question_options WHERE question_id='ci-question' ORDER BY stable_option_id))),
 json_object('correctOption',(SELECT correct_option FROM question_drafts WHERE question_id='ci-question'),
 'explanation',(SELECT explanation FROM question_drafts WHERE question_id='ci-question'))
FROM exam_versions WHERE id='ci-version-2' AND status='draft' AND published_at IS NULL;
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-snapshot-assert',1,
CASE WHEN (SELECT COUNT(*) FROM exam_items WHERE id='ci-snapshot-item')=1
 AND (SELECT json_array_length(json_extract(question_snapshot_json,'$.options')) FROM exam_items WHERE id='ci-snapshot-item')=4
 AND (SELECT json_extract(answer_key_private_json,'$.correctOption') FROM exam_items WHERE id='ci-snapshot-item')='B'
 AND (SELECT json_type(question_snapshot_json,'$.correctOption') FROM exam_items WHERE id='ci-snapshot-item') IS NULL
 AND (SELECT json_type(question_snapshot_json,'$.explanation') FROM exam_items WHERE id='ci-snapshot-item') IS NULL
 THEN 1 ELSE -1 END,1;
PRAGMA foreign_key_check;
