import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const core='exam_core',results='exam_results';
const required={
 users:['id','email','password_hash','status','created_at'],roles:['id','code'],user_roles:['user_id','role_id'],sessions:['id','user_id','token_hash','expires_at','revoked_at'],subjects:['id','slug','title'],topics:['id','subject_id','title'],questions:['id','topic_id','status'],question_options:['id','question_id','stable_option_id','body'],exams:['id','subject_id','title'],exam_versions:['id','exam_id','version_number','content_hash','published_at','status','items_revision'],exam_items:['id','exam_version_id','position','question_snapshot_json','answer_key_private_json'],question_drafts:['question_id','body','correct_option','explanation'],core_audit_logs:['id','actor_id','action','target_id','created_at'],login_rate_limits:['bucket_key','window_start','attempts','updated_at']};
const learning={learning_lessons:['id','subject_id','title','body','position','status','created_at','updated_at'],learning_materials:['id','subject_id','title','description','url','status','created_at','updated_at'],lesson_progress:['user_id','lesson_id','completed','updated_at'],discussion_posts:['id','subject_id','user_id','body','hidden','created_at'],announcements:['id','title','body','author_id','archived','created_at'],announcement_reads:['user_id','announcement_id','read_at']};
const imports={question_source_hashes:['subject_id','fingerprint','question_id'],exam_import_receipts:['import_key','actor_id','request_hash','exam_id','version_id','question_count','source_name','created_at']};
const resultTables={attempts:['id','user_id','exam_version_id','status','save_version','answer_snapshot_json','expires_at'],scores:['id','attempt_id','points','max_points'],submission_receipts:['id','attempt_id','idempotency_key','response_json'],audit_logs:['id','actor_id','action','target_id','created_at']};
function fail(message){throw Error(message)}
async function columns(query,db,table){return await query(db,'PRAGMA table_info('+table+')')}
async function verifyTables(query,db,tables,optional=false){for(const [table,names] of Object.entries(tables)){const rows=await columns(query,db,table);if(optional&&rows.length===0)continue;const actual=new Set(rows.map(row=>row.name));if(names.some(name=>!actual.has(name)))fail('Incompatible or missing schema: '+db+'.'+table)}}
async function counts(query,db,tables){const values={};for(const table of Object.keys(tables)){const rows=await query(db,'SELECT COUNT(*) AS n FROM '+table);values[table]=Number(rows[0]?.n);if(!Number.isSafeInteger(values[table])||values[table]<0)fail('Invalid count for '+table)}return values}
async function integrity(query,db){if((await query(db,'PRAGMA foreign_key_check')).length)fail('Foreign-key violations in '+db)}
export async function migrateRelease({query,execute,log=()=>{}}){
 await verifyTables(query,core,required);await verifyTables(query,results,resultTables);await verifyTables(query,core,learning,true);await verifyTables(query,core,imports,true);
 await integrity(query,core);await integrity(query,results);
 const beforeCore=await counts(query,core,required),beforeResults=await counts(query,results,resultTables);
 const versions=await query(core,'SELECT id,exam_id,version_number,content_hash,published_at,status FROM exam_versions WHERE published_at IS NOT NULL ORDER BY id LIMIT 10001');if(versions.length>10000)fail('Too many published versions for this bounded upgrade');
 const versionColumns=await columns(query,core,'exam_versions');
 if(!versionColumns.some(row=>row.name==='duration_minutes')){await execute(core,readFileSync(resolve(root,'packages/db/migrations/core/0006_exam_duration.sql'),'utf8'));log('Applied core 0006')}else log('Core 0006 already present');
 const invalid=await query(core,'SELECT COUNT(*) AS n FROM exam_versions WHERE duration_minutes IS NULL OR duration_minutes<5 OR duration_minutes>240');if(Number(invalid[0]?.n)!==0)fail('Invalid exam durations');
 await execute(core,readFileSync(resolve(root,'packages/db/migrations/core/0007_learning_content.sql'),'utf8'));
 const community=readFileSync(resolve(root,'packages/db/migrations/core/0008_learning_community.sql'),'utf8').replace(/CREATE TABLE /g,'CREATE TABLE IF NOT EXISTS ').replace(/CREATE INDEX /g,'CREATE INDEX IF NOT EXISTS ');
 await execute(core,community);await verifyTables(query,core,learning);
 const userColumns=await columns(query,core,'users');
 for(const name of ['deleted_at','deleted_previous_status'])if(!userColumns.some(row=>row.name===name))await execute(core,'ALTER TABLE users ADD COLUMN '+name+(name==='deleted_at'?' INTEGER':' TEXT')+';');
 const importSQL=readFileSync(resolve(root,'packages/db/migrations/core/0009_admin_exam_import.sql'),'utf8').replace(/^ALTER TABLE users ADD COLUMN .+;$/gm,'').replace(/CREATE TABLE /g,'CREATE TABLE IF NOT EXISTS ').replace(/CREATE INDEX /g,'CREATE INDEX IF NOT EXISTS ');
 await execute(core,importSQL);await verifyTables(query,core,imports);
 await execute(results,readFileSync(resolve(root,'packages/db/migrations/results/0002_leaderboard_index.sql'),'utf8'));
 const index=await query(results,'PRAGMA index_info(attempts_version_user_submitted_idx)');if(index.map(row=>row.name).join(',')!=='exam_version_id,status,user_id,submitted_at,id')fail('Incompatible leaderboard index');
 await integrity(query,core);await integrity(query,results);
 const afterCore=await counts(query,core,required),afterResults=await counts(query,results,resultTables);
 for(const [table,n] of Object.entries(beforeCore))if(afterCore[table]<n)fail('Unexpected loss of rows in '+table);
 for(const [table,n] of Object.entries(beforeResults))if(afterResults[table]<n)fail('Unexpected loss of rows in '+table);
 const afterVersions=new Map((await query(core,'SELECT id,exam_id,version_number,content_hash,published_at,status FROM exam_versions WHERE published_at IS NOT NULL ORDER BY id LIMIT 10001')).map(row=>[row.id,JSON.stringify(row)]));
 for(const row of versions)if(afterVersions.get(row.id)!==JSON.stringify(row))fail('A published exam changed during upgrade');
 await execute(core,"CREATE TABLE IF NOT EXISTS studyweb_release_migrations(version TEXT PRIMARY KEY,applied_at INTEGER NOT NULL); INSERT OR IGNORE INTO studyweb_release_migrations VALUES('core-0006-0007-0008-0009',unixepoch());");
 await execute(results,"CREATE TABLE IF NOT EXISTS studyweb_release_migrations(version TEXT PRIMARY KEY,applied_at INTEGER NOT NULL); INSERT OR IGNORE INTO studyweb_release_migrations VALUES('results-0002',unixepoch());");
 log('Schema upgrade verified; existing row counts and published exam content retained');
 return {beforeCore,afterCore,beforeResults,afterResults,publishedVersions:versions.length};
}
export function wranglerAdapter(){
 const local=process.env.STUDYWEB_MIGRATION_LOCAL==='1';
 function run(db,sql){const child=spawnSync('npx',['wrangler','d1','execute',db,local?'--local':'--remote','--json','--command='+sql],{cwd:resolve(root,'apps/api'),encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(child.status!==0)fail('D1 operation failed for '+db+' (exit '+child.status+'); no baseline initialization attempted');let parsed;try{parsed=JSON.parse(child.stdout)}catch{fail('D1 response was not valid JSON for '+db)}const entries=Array.isArray(parsed)?parsed:[parsed];if(entries.some(entry=>entry.success===false))fail('D1 reported a failed operation for '+db);return entries.flatMap(entry=>Array.isArray(entry.results)?entry.results:[])}
 return {query:async(db,sql)=>run(db,sql),execute:async(db,sql)=>{run(db,sql)},log:console.log};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){await migrateRelease(wranglerAdapter())}
