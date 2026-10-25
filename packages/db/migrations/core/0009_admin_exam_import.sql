-- Recoverable student removal; retain grades, discussions and completion records.
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
ALTER TABLE users ADD COLUMN deleted_previous_status TEXT;
CREATE INDEX users_deleted_created_idx ON users(deleted_at,created_at,id);
CREATE TABLE question_source_hashes(
 subject_id TEXT NOT NULL REFERENCES subjects(id),
 fingerprint TEXT NOT NULL,
 question_id TEXT NOT NULL REFERENCES questions(id),
 PRIMARY KEY(subject_id,fingerprint)
);
CREATE TABLE exam_import_receipts(
 import_key TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES users(id),
 request_hash TEXT NOT NULL,
 exam_id TEXT NOT NULL REFERENCES exams(id),
 version_id TEXT NOT NULL REFERENCES exam_versions(id),
 question_count INTEGER NOT NULL,
 source_name TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
