-- Additive: retain all existing users, learning content and published exams.
CREATE TABLE lesson_progress(
 user_id TEXT NOT NULL REFERENCES users(id),
 lesson_id TEXT NOT NULL REFERENCES learning_lessons(id),
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,lesson_id)
);
CREATE INDEX lesson_progress_lesson_idx ON lesson_progress(lesson_id,completed,user_id);
CREATE TABLE discussion_posts(
 id TEXT PRIMARY KEY,
 subject_id TEXT NOT NULL REFERENCES subjects(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
 created_at INTEGER NOT NULL
);
CREATE INDEX discussion_subject_idx ON discussion_posts(subject_id,hidden,created_at,id);
CREATE INDEX discussion_user_rate_idx ON discussion_posts(user_id,created_at);
CREATE TABLE announcements(
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 160),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),
 author_id TEXT NOT NULL REFERENCES users(id),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at INTEGER NOT NULL
);
CREATE INDEX announcements_created_idx ON announcements(archived,created_at,id);
CREATE TABLE announcement_reads(
 user_id TEXT NOT NULL REFERENCES users(id),
 announcement_id TEXT NOT NULL REFERENCES announcements(id),
 read_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,announcement_id)
);
