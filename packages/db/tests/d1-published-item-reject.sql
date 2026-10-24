-- This version was published in d1-version-check.sql.
-- The existing BEFORE INSERT trigger must reject the item.
INSERT INTO exam_items(id,exam_version_id,position,question_snapshot_json,answer_key_private_json)
VALUES('ci-rejected-published-item','ci-version-1',0,
 '{"questionId":"ci-question","body":"This must not be inserted","options":[]}',
 '{"correctOption":"A"}');
