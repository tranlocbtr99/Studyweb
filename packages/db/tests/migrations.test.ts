import { describe,it,expect } from 'vitest';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
const sql=(name:'core'|'results')=>readFileSync(new URL('../migrations/'+name+'/0001_initial.sql',import.meta.url),'utf8');
describe('D1 initial schema',()=>{
 for(const name of ['core','results'] as const){
  it(name+' migrates and enforces foreign keys',async()=>{const SQL=await initSqlJs();const db=new SQL.Database();db.run(sql(name));expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);expect(db.exec("SELECT name FROM sqlite_master WHERE type='table'").length).toBeGreaterThan(0);db.close();});
 }
 it('published exam items cannot be changed',async()=>{const SQL=await initSqlJs();const db=new SQL.Database();db.run(sql('core'));db.run("INSERT INTO subjects VALUES('s','s','S'); INSERT INTO exams VALUES('e','s','E'); INSERT INTO exam_versions VALUES('v','e',1,'hash',1,'published');");expect(()=>db.run("INSERT INTO exam_items VALUES('i','v',0,'{}','{}')")).toThrow(/immutable/);db.close();});
 it('autosave CAS rejects stale version',async()=>{const SQL=await initSqlJs();const db=new SQL.Database();db.run(sql('results'));db.run("INSERT INTO attempts(id,user_id,exam_version_id,exam_content_hash,grading_snapshot_json,started_at,expires_at,updated_at) VALUES('a','u','v','hash','{}',1,100,1)");db.run("UPDATE attempts SET save_version=save_version+1,answer_snapshot_json='{}' WHERE id='a' AND status='active' AND save_version=0");db.run("UPDATE attempts SET save_version=save_version+1 WHERE id='a' AND status='active' AND save_version=0");expect(db.exec("SELECT save_version FROM attempts WHERE id='a'")[0].values[0][0]).toBe(1);db.close();});
 it('duplicate score and receipt blocked',async()=>{const SQL=await initSqlJs();const db=new SQL.Database();db.run(sql('results'));db.run("INSERT INTO attempts(id,user_id,exam_version_id,exam_content_hash,grading_snapshot_json,started_at,expires_at,updated_at) VALUES('a','u','v','hash','{}',1,100,1)");db.run("INSERT INTO scores VALUES('s','a',1,1,2,'v1')");expect(()=>db.run("INSERT INTO scores VALUES('s2','a',1,1,2,'v1')")).toThrow();db.run("INSERT INTO submission_receipts VALUES('r','a','k','{}',2)");expect(()=>db.run("INSERT INTO submission_receipts VALUES('r2','a','k','{}',2)")).toThrow();db.close();});
});
