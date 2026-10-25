-- Additive rich-content storage. No existing exam or credential row is rewritten.
CREATE TABLE exam_assets (
 id TEXT PRIMARY KEY, mime TEXT NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
 data_base64 TEXT NOT NULL, digest TEXT NOT NULL, byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 200000),
 created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
);
CREATE INDEX exam_assets_owner_idx ON exam_assets(created_by,created_at);
CREATE TABLE question_rich_content (
 question_id TEXT PRIMARY KEY REFERENCES questions(id), content_json TEXT NOT NULL CHECK(json_valid(content_json))
);
CREATE TABLE exam_asset_links (
 asset_id TEXT NOT NULL REFERENCES exam_assets(id), version_id TEXT NOT NULL REFERENCES exam_versions(id),
 PRIMARY KEY(asset_id,version_id)
);
CREATE INDEX exam_asset_links_version_idx ON exam_asset_links(version_id);
