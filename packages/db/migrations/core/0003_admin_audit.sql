CREATE TABLE IF NOT EXISTS core_audit_logs(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,target_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS core_audit_actor_idx ON core_audit_logs(actor_id,created_at);
