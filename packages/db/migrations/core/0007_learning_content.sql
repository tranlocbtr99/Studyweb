-- Additive learning content storage. Existing exams and attempts remain untouched.
CREATE TABLE IF NOT EXISTS learning_lessons (
 id TEXT PRIMARY KEY,
 subject_id TEXT NOT NULL REFERENCES subjects(id),
 title TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '',
 position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS learning_lessons_subject_idx ON learning_lessons(subject_id,status,position,id);
CREATE TABLE IF NOT EXISTS learning_materials (
 id TEXT PRIMARY KEY,
 subject_id TEXT NOT NULL REFERENCES subjects(id),
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 url TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS learning_materials_subject_idx ON learning_materials(subject_id,status,created_at,id);
