-- Verify question draft persistence and A-D option integrity on local D1.
INSERT INTO topics(id,subject_id,title)
VALUES('ci-question-topic','ci-admin-subject','Question topic');
INSERT INTO questions(id,topic_id,status)
VALUES('ci-question','ci-question-topic','draft');
INSERT INTO question_drafts(question_id,body,correct_option,explanation)
VALUES('ci-question','What is an economic demand?','B','A validated explanation.');
INSERT INTO question_options(id,question_id,stable_option_id,body) VALUES
('ci-option-a','ci-question','A','Supply'),
('ci-option-b','ci-question','B','Demand'),
('ci-option-c','ci-question','C','Revenue'),
('ci-option-d','ci-question','D','Profit');
-- A constrained insert fails if question data is incomplete or invalid.
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-question-assert',1,
CASE WHEN
 (SELECT COUNT(*) FROM question_options WHERE question_id='ci-question')=4
 AND (SELECT COUNT(DISTINCT stable_option_id) FROM question_options WHERE question_id='ci-question')=4
 AND (SELECT correct_option FROM question_drafts WHERE question_id='ci-question')='B'
 AND (SELECT status FROM questions WHERE id='ci-question')='draft'
 THEN 1 ELSE -1 END,1;
-- Duplicate option label must be rejected by the unique constraint.
INSERT OR IGNORE INTO question_options(id,question_id,stable_option_id,body)
VALUES('ci-option-duplicate','ci-question','B','Invalid duplicate');
INSERT INTO login_rate_limits(bucket_key,window_start,attempts,updated_at)
SELECT 'ci-question-unique-assert',1,
CASE WHEN (SELECT COUNT(*) FROM question_options WHERE question_id='ci-question')=4
 AND NOT EXISTS(SELECT 1 FROM question_options WHERE id='ci-option-duplicate')
 THEN 1 ELSE -1 END,1;
PRAGMA foreign_key_check;
