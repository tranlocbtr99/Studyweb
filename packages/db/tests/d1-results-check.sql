INSERT INTO attempts(id,user_id,exam_version_id,exam_content_hash,grading_snapshot_json,started_at,expires_at,updated_at)
VALUES('ci-attempt','ci-user','ci-version','ci-hash','{}',1,100,1);
INSERT INTO scores(id,attempt_id,points,max_points,graded_at,grading_version)
VALUES('ci-score','ci-attempt',1,1,2,'ci-version');
INSERT INTO submission_receipts(id,attempt_id,idempotency_key,response_json,created_at)
VALUES('ci-receipt','ci-attempt','ci-key','{}',2);
PRAGMA foreign_key_check;
