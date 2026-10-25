-- Configurable exam duration, preserving the previous 90-minute default.
ALTER TABLE exam_versions ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 90 CHECK(duration_minutes BETWEEN 5 AND 240);
