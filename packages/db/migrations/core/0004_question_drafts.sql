-- Draft-only authoring metadata; answer keys are never included in public question reads.
CREATE TABLE IF NOT EXISTS question_drafts(
 question_id TEXT PRIMARY KEY REFERENCES questions(id),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 5 AND 4000),
 correct_option TEXT NOT NULL CHECK(correct_option IN ('A','B','C','D')),
 explanation TEXT NOT NULL DEFAULT ''
);
