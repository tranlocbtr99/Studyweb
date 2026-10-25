-- Additive read-path index for best-attempt ranking by exam version.
CREATE INDEX IF NOT EXISTS attempts_version_user_submitted_idx
ON attempts(exam_version_id,status,user_id,submitted_at,id);
