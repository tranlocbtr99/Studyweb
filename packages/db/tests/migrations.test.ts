import { describe, it, expect } from 'vitest';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
const migration = (db: 'core' | 'results') => readFileSync(new URL('../migrations/' + db + '/0001_initial.sql', import.meta.url), 'utf8');
async function open(name: 'core' | 'results') {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(migration(name));
  return db;
}
describe('Initial D1 SQLite migrations', () => {
  for (const name of ['core', 'results'] as const) {
    it(name + ': applies cleanly and has no foreign key violations', async () => {
      const db = await open(name);
      expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
      expect(db.exec("SELECT name FROM sqlite_master WHERE type='table'").length).toBeGreaterThan(0);
      db.close();
    });
  }
  it('published versions and items are immutable, revocation remains possible', async () => {
    const db = await open('core');
    db.run("INSERT INTO subjects VALUES('s','s','S'); INSERT INTO exams VALUES('e','s','E'); INSERT INTO exam_versions VALUES('v','e',1,'hash',NULL,'draft'); INSERT INTO exam_items VALUES('i','v',0,'{}','{}');");
    db.run("UPDATE exam_versions SET published_at=10,status='published' WHERE id='v'");
    expect(() => db.run("UPDATE exam_items SET question_snapshot_json='[]' WHERE id='i'")).toThrow(/immutable/);
    expect(() => db.run("DELETE FROM exam_items WHERE id='i'")).toThrow(/immutable/);
    expect(() => db.run("INSERT INTO exam_items VALUES('j','v',1,'{}','{}')")).toThrow(/immutable/);
    expect(() => db.run("UPDATE exam_versions SET content_hash='changed' WHERE id='v'")).toThrow(/immutable/);
    db.run("UPDATE exam_versions SET status='revoked' WHERE id='v'");
    expect(() => db.run("DELETE FROM exam_versions WHERE id='v'")).toThrow(/immutable/);
    db.close();
  });
  it('stale autosave cannot overwrite a newer snapshot', async () => {
    const db = await open('results');
    db.run("INSERT INTO attempts(id,user_id,exam_version_id,exam_content_hash,grading_snapshot_json,started_at,expires_at,updated_at) VALUES('a','u','v','hash','{}',1,100,1)");
    db.run("UPDATE attempts SET save_version=save_version+1,answer_snapshot_json='{\"q1\":\"a\"}' WHERE id='a' AND status='active' AND save_version=0");
    db.run("UPDATE attempts SET save_version=save_version+1,answer_snapshot_json='{\"q1\":\"b\"}' WHERE id='a' AND status='active' AND save_version=0");
    const row = db.exec("SELECT save_version,answer_snapshot_json FROM attempts WHERE id='a'")[0].values[0];
    expect(row).toEqual([1, '{"q1":"a"}']);
    db.close();
  });
  it('scores and receipts cannot be duplicated or changed', async () => {
    const db = await open('results');
    db.run("INSERT INTO attempts(id,user_id,exam_version_id,exam_content_hash,grading_snapshot_json,started_at,expires_at,updated_at) VALUES('a','u','v','hash','{}',1,100,1)");
    db.run("INSERT INTO scores VALUES('s','a',1,1,2,'v1')");
    expect(() => db.run("INSERT INTO scores VALUES('s2','a',1,1,2,'v1')")).toThrow();
    expect(() => db.run("UPDATE scores SET points=0 WHERE id='s'")).toThrow(/immutable/);
    db.run("INSERT INTO submission_receipts VALUES('r','a','k','{}',2)");
    expect(() => db.run("INSERT INTO submission_receipts VALUES('r2','a','k','{}',2)")).toThrow();
    expect(() => db.run("DELETE FROM submission_receipts WHERE id='r'")).toThrow(/immutable/);
    db.close();
  });
});
