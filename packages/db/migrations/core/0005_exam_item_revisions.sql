-- Block any edits to draft exam items during the publication window.
-- A monotonically increasing revision enables optimistic concurrency checks.
ALTER TABLE exam_versions ADD COLUMN items_revision INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER exam_items_revision_insert AFTER INSERT ON exam_items
BEGIN
 UPDATE exam_versions SET items_revision=items_revision+1 WHERE id=NEW.exam_version_id;
END;
CREATE TRIGGER exam_items_revision_update AFTER UPDATE ON exam_items
BEGIN
 UPDATE exam_versions SET items_revision=items_revision+1 WHERE id=NEW.exam_version_id;
END;
CREATE TRIGGER exam_items_revision_delete AFTER DELETE ON exam_items
BEGIN
 UPDATE exam_versions SET items_revision=items_revision+1 WHERE id=OLD.exam_version_id;
END;
