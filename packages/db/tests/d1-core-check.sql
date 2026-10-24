-- Must error if migrations or required tables are missing.
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at) VALUES('ci',1,1,1);
UPDATE login_rate_limits SET attempts=attempts+1 WHERE bucket_key='ci';
SELECT attempts FROM login_rate_limits WHERE bucket_key='ci';
INSERT INTO subjects(id,slug,title) VALUES('ci-subject','ci-subject','CI subject');
INSERT INTO exams(id,subject_id,title) VALUES('ci-exam','ci-subject','CI exam');
INSERT INTO exam_versions(id,exam_id,version_number,content_hash,published_at,status)
VALUES('ci-version','ci-exam',1,'ci-hash',NULL,'draft');
INSERT INTO exam_items(id,exam_version_id,position,question_snapshot_json,answer_key_private_json)
VALUES('ci-item','ci-version',0,'{}','{}');
PRAGMA foreign_key_check;
