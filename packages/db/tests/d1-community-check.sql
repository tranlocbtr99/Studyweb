-- CI-only fixtures against the local D1 runtime, never production.
CREATE TABLE community_ci_assert(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO users(id,email,password_hash,status,created_at) VALUES('community-ci-user','community-ci@example.com','unused','active',1);
INSERT INTO learning_lessons(id,subject_id,title,body,position,status,created_at,updated_at) VALUES('community-ci-lesson','ci-subject','CI lesson','Text',0,'published',1,1);
INSERT INTO lesson_progress(user_id,lesson_id,completed,updated_at) VALUES('community-ci-user','community-ci-lesson',1,1);
INSERT INTO lesson_progress(user_id,lesson_id,completed,updated_at) VALUES('community-ci-user','community-ci-lesson',0,2) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at;
INSERT INTO community_ci_assert SELECT CASE WHEN COUNT(*)=1 AND MAX(completed)=0 THEN 1 ELSE 0 END FROM lesson_progress WHERE user_id='community-ci-user';
INSERT INTO discussion_posts(id,subject_id,user_id,body,created_at) SELECT 'community-ci-post','ci-subject','community-ci-user','CI post',2 WHERE (SELECT COUNT(*) FROM discussion_posts WHERE user_id='community-ci-user' AND created_at>0)<5;
UPDATE discussion_posts SET hidden=1 WHERE id='community-ci-post';
INSERT INTO community_ci_assert SELECT CASE WHEN hidden=1 THEN 1 ELSE 0 END FROM discussion_posts WHERE id='community-ci-post';
INSERT INTO announcements(id,title,body,author_id,created_at) VALUES('community-ci-notice','CI notice','Text','community-ci-user',1);
INSERT INTO announcement_reads(user_id,announcement_id,read_at) VALUES('community-ci-user','community-ci-notice',1);
INSERT INTO announcement_reads(user_id,announcement_id,read_at) VALUES('community-ci-user','community-ci-notice',2) ON CONFLICT(user_id,announcement_id) DO UPDATE SET read_at=excluded.read_at;
INSERT INTO community_ci_assert SELECT CASE WHEN COUNT(*)=1 AND MAX(read_at)=2 THEN 1 ELSE 0 END FROM announcement_reads WHERE user_id='community-ci-user';
INSERT INTO community_ci_assert SELECT CASE WHEN COUNT(*)=3 THEN 1 ELSE 0 END FROM community_ci_assert;
PRAGMA foreign_key_check;
