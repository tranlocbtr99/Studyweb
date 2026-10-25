import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
import app from '../src/index';
import type {ReadDb,ReadQuery} from '../src/auth';
const id='123e4567-e89b-42d3-a456-426614174000',attemptId='123e4567-e89b-42d3-a456-426614174001',token='c'.repeat(64);
async function fixture(admin=false){
 const core=new DatabaseSync(':memory:'),results=new DatabaseSync(':memory:');
 for(const [db,group] of [[core,'core'],[results,'results']] as const){const directory=resolve('../../packages/db/migrations',group);for(const file of readdirSync(directory).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(resolve(directory,file),'utf8'));}
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');const now=Math.floor(Date.now()/1000);
 core.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('user','qa@example.com','unused','active',now);
 core.prepare('INSERT INTO roles VALUES(?,?)').run('role',admin?'admin':'student');core.prepare('INSERT INTO user_roles VALUES(?,?)').run('user','role');core.prepare('INSERT INTO sessions VALUES(?,?,?,?,NULL)').run('session','user',hash,now+3600);
 core.prepare('INSERT INTO subjects VALUES(?,?,?)').run(id,'published-subject','Published subject');core.prepare('INSERT INTO subjects VALUES(?,?,?)').run(attemptId,'hidden-subject','Hidden draft subject');
 for(const [lesson,subject,status] of [['published',id,'published'],['draft',attemptId,'draft'],['archived',id,'archived']])core.prepare('INSERT INTO learning_lessons VALUES(?,?,?,?,?,?,?,?)').run(lesson,subject,lesson,'Text',0,status,now,now);
 results.prepare("INSERT INTO attempts(id,user_id,exam_version_id,exam_content_hash,grading_snapshot_json,started_at,expires_at,status,save_version,answer_snapshot_json,updated_at) VALUES(?,?,?,?,?,?,?,'active',1,?,?)").run(attemptId,'user',id,'hash',JSON.stringify([{position:0,correctOption:'B'}]),now-600,now-10,JSON.stringify({'0':'B'}),now-20);
 function wrap(db:DatabaseSync):ReadDb{return {prepare(sql){let args:unknown[]=[];const query:ReadQuery={bind(...values){args=values;return query},async first<T>(){return (db.prepare(sql).get(...args as never[])??null) as T|null},async all(){return {results:db.prepare(sql).all(...args as never[])}},async run(){const result=db.prepare(sql).run(...args as never[]);return {meta:{changes:Number(result.changes)}}}};return query},async batch(queries){db.exec('BEGIN');try{const writes=[];for(const q of queries)writes.push(await q.run());db.exec('COMMIT');return writes}catch(error){db.exec('ROLLBACK');throw error}}}}
 const env={EXAM_CORE:wrap(core),EXAM_RESULTS:wrap(results)},headers={Cookie:'studyweb_session='+token,Origin:'http://localhost','Content-Type':'application/json'};return {env,headers,core,results,close(){core.close();results.close()}};
}
describe('learning and deadlines with real SQLite',()=>{
 it('requires authentication',async()=>{expect((await app.request('/api/v1/student/subjects')).status).toBe(401)});
 it('includes learning-only subjects, hides draft-only subjects',async()=>{const f=await fixture();try{const response=await app.request('/api/v1/student/subjects',{headers:f.headers},f.env);expect(response.status).toBe(200);const data=await response.json();expect(data.subjects).toHaveLength(1);expect(data.subjects[0]).toMatchObject({id,lessonCount:1,materialCount:0,examCount:0});}finally{f.close()}});
 it('rejects answer changes after deadline',async()=>{const f=await fixture();try{const response=await app.request('/api/v1/student/attempts/'+attemptId+'/answers',{method:'PUT',headers:f.headers,body:JSON.stringify({saveVersion:1,answers:{'0':'A'}})},f.env);expect(response.status).toBe(409);expect(f.results.prepare('SELECT answer_snapshot_json FROM attempts').get()?.answer_snapshot_json).toBe('{"0":"B"}');}finally{f.close()}});
 it('grades saved answers after deadline and replays without duplicate score',async()=>{const f=await fixture();try{const request={method:'POST',headers:f.headers,body:JSON.stringify({saveVersion:1,idempotencyKey:attemptId})};const path='/api/v1/student/attempts/'+attemptId+'/submit';const first=await app.request(path,request,f.env);expect(first.status).toBe(200);expect((await first.json()).result.points).toBe(1);expect((await app.request(path,request,f.env)).status).toBe(200);expect(f.results.prepare('SELECT COUNT(*) AS count FROM scores').get()?.count).toBe(1);}finally{f.close()}});
 it('denies student archive access',async()=>{const f=await fixture();try{expect((await app.request('/api/v1/admin/learning/lessons/'+id+'/status',{method:'PATCH',headers:f.headers,body:'{"status":"archived"}'},f.env)).status).toBe(403);}finally{f.close()}});
 it('filters the admin directory with real SQL',async()=>{const f=await fixture(true);try{const response=await app.request('/api/v1/admin/learning?'+new URLSearchParams({subjectId:id,kind:'lesson',status:'archived',search:'archived'}),{headers:f.headers},f.env);expect(response.status).toBe(200);const data=await response.json();expect(data.total).toBe(1);expect(data.items[0].status).toBe('archived');}finally{f.close()}});
 it('returns administrator results and expired analytics from the results DB',async()=>{const f=await fixture(true);try{
  const response=await app.request('/api/v1/admin/results?status=expired',{headers:f.headers},f.env);expect(response.status).toBe(200);const data=await response.json();expect(data.total).toBe(1);expect(data.results[0]).toMatchObject({email:'qa@example.com',status:'expired'});expect(JSON.stringify(data)).not.toContain('correctOption');
  const analytics=await app.request('/api/v1/admin/analytics',{headers:f.headers},f.env);expect(analytics.status).toBe(200);expect((await analytics.json()).statuses).toContainEqual({status:'expired',count:1});
 }finally{f.close()}});
 it('archives and restores a lesson with one audit per valid transition',async()=>{const f=await fixture(true);try{
  const now=Math.floor(Date.now()/1000);f.core.prepare('INSERT INTO learning_lessons VALUES(?,?,?,?,?,?,?,?)').run(id,id,'Editable','Text',0,'published',now,now);
  const path='/api/v1/admin/learning/lessons/'+id+'/status';
  for(const status of ['archived','draft'])expect((await app.request(path,{method:'PATCH',headers:f.headers,body:JSON.stringify({status})},f.env)).status).toBe(200);
  expect(f.core.prepare('SELECT status FROM learning_lessons WHERE id=?').get(id)?.status).toBe('draft');expect(f.core.prepare('SELECT COUNT(*) AS n FROM core_audit_logs').get()?.n).toBe(2);
  expect((await app.request(path,{method:'PATCH',headers:f.headers,body:'{"status":"draft"}'},f.env)).status).toBe(409);expect(f.core.prepare('SELECT COUNT(*) AS n FROM core_audit_logs').get()?.n).toBe(2);
 }finally{f.close()}});
 it('blocks student access to administrative results and analytics',async()=>{const f=await fixture();try{for(const path of ['/api/v1/admin/results','/api/v1/admin/analytics'])expect((await app.request(path,{headers:f.headers},f.env)).status).toBe(403)}finally{f.close()}});

});

describe('persistent progress and community integration',()=>{
 const lessonId='123e4567-e89b-42d3-a456-426614174010';
 function seedLesson(f:Awaited<ReturnType<typeof fixture>>,status='published'){const now=Math.floor(Date.now()/1000);f.core.prepare('INSERT INTO learning_lessons VALUES(?,?,?,?,?,?,?,?)').run(lessonId,id,'Lesson with progress','Text',1,status,now,now)}
 it('persists progress and exposes only the signed-in user completion',async()=>{const f=await fixture();try{
  seedLesson(f);const path='/api/v1/community/lessons/'+lessonId+'/progress';
  const write=await app.request(path,{method:'PUT',headers:f.headers,body:'{"completed":true}'},f.env);expect(write.status).toBe(200);
  const catalog=await app.request('/api/v1/student/subjects',{headers:f.headers},f.env);expect((await catalog.json()).subjects[0].completedLessons).toBe(1);
  const read=await app.request('/api/v1/student/learning-content?subjectId='+id,{headers:f.headers},f.env);expect((await read.json()).lessons.find((l:{id:string})=>l.id===lessonId).completed).toBe(1);
  f.core.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('other','other@example.com','unused','active',1);f.core.prepare("UPDATE sessions SET user_id='other'").run();
  const other=await app.request('/api/v1/student/learning-content?subjectId='+id,{headers:f.headers},f.env);expect((await other.json()).lessons.find((l:{id:string})=>l.id===lessonId).completed).toBe(0);
 }finally{f.close()}});
 it('keeps the progress row when marking a lesson incomplete',async()=>{const f=await fixture();try{seedLesson(f);for(const completed of [true,false])expect((await app.request('/api/v1/community/lessons/'+lessonId+'/progress',{method:'PUT',headers:f.headers,body:JSON.stringify({completed})},f.env)).status).toBe(200);expect(f.core.prepare('SELECT completed FROM lesson_progress').get()?.completed).toBe(0);expect(f.core.prepare('SELECT COUNT(*) AS n FROM lesson_progress').get()?.n).toBe(1)}finally{f.close()}});
 it('rejects progress for unpublished lessons and cross-origin writes',async()=>{const f=await fixture();try{seedLesson(f,'draft');const path='/api/v1/community/lessons/'+lessonId+'/progress';expect((await app.request(path,{method:'PUT',headers:f.headers,body:'{"completed":true}'},f.env)).status).toBe(404);expect((await app.request(path,{method:'PUT',headers:{...f.headers,Origin:'https://other.example'},body:'{"completed":true}'},f.env)).status).toBe(403)}finally{f.close()}});
 it('limits discussion posting, uses aliases and does not expose account IDs',async()=>{const f=await fixture();try{
  const req={method:'POST',headers:f.headers,body:JSON.stringify({subjectId:id,body:'A question about the lesson'})};for(let i=0;i<5;i++)expect((await app.request('/api/v1/community/discussion',req,f.env)).status).toBe(201);expect((await app.request('/api/v1/community/discussion',req,f.env)).status).toBe(429);
  const read=await app.request('/api/v1/community/discussion?subjectId='+id,{headers:f.headers},f.env);const data=await read.json();expect(data.posts).toHaveLength(5);expect(data.posts[0].isMe).toBe(true);expect(data.posts[0].author).toMatch(/^Học viên [a-f0-9]{6}$/);expect(JSON.stringify(data)).not.toContain('qa@example.com');expect(JSON.stringify(data)).not.toContain('userId');
 }finally{f.close()}});
 it('rejects discussion on private subjects and invalid pagination',async()=>{const f=await fixture();try{expect((await app.request('/api/v1/community/discussion',{method:'POST',headers:f.headers,body:JSON.stringify({subjectId:attemptId,body:'Hidden'})},f.env)).status).toBe(404);expect((await app.request('/api/v1/community/discussion?subjectId='+id+'&offset=-1',{headers:f.headers},f.env)).status).toBe(400)}finally{f.close()}});
 it('allows admin moderation without deleting a post',async()=>{const f=await fixture(true);try{
  const post=await app.request('/api/v1/community/discussion',{method:'POST',headers:f.headers,body:JSON.stringify({subjectId:id,body:'Moderate this post'})},f.env);const postId=(await post.json()).id;
  const adminList=await app.request('/api/v1/community/admin/discussion?subjectId='+id,{headers:f.headers},f.env);expect(adminList.status).toBe(200);expect((await adminList.json()).posts[0].author).toBe('qa@example.com');
  for(const hidden of [true,false]){expect((await app.request('/api/v1/community/admin/discussion/'+postId+'/visibility',{method:'PATCH',headers:f.headers,body:JSON.stringify({hidden})},f.env)).status).toBe(200);const read=await app.request('/api/v1/community/discussion?subjectId='+id,{headers:f.headers},f.env);expect((await read.json()).posts).toHaveLength(hidden?0:1)}expect(f.core.prepare('SELECT COUNT(*) AS n FROM discussion_posts').get()?.n).toBe(1);
 }finally{f.close()}});
 it('lets admins publish, archive and restore announcements and users mark read idempotently',async()=>{const f=await fixture(true);try{
  const post=await app.request('/api/v1/community/admin/announcements',{method:'POST',headers:f.headers,body:'{"title":"New announcement","body":"Read this update"}'},f.env);expect(post.status).toBe(201);const noticeId=(await post.json()).id;
  const read=()=>app.request('/api/v1/community/announcements',{headers:f.headers},f.env);expect((await (await read()).json()).unread).toBe(1);
  for(let i=0;i<2;i++)expect((await app.request('/api/v1/community/announcements/'+noticeId+'/read',{method:'PUT',headers:f.headers},f.env)).status).toBe(200);expect((await (await read()).json()).unread).toBe(0);expect(f.core.prepare('SELECT COUNT(*) AS n FROM announcement_reads').get()?.n).toBe(1);
  for(const archived of [true,false]){expect((await app.request('/api/v1/community/admin/announcements/'+noticeId,{method:'PATCH',headers:f.headers,body:JSON.stringify({archived})},f.env)).status).toBe(200);expect((await (await read()).json()).announcements).toHaveLength(archived?0:1)}
 }finally{f.close()}});
 it('prevents students publishing announcements or moderating discussion',async()=>{const f=await fixture();try{expect((await app.request('/api/v1/community/admin/announcements',{method:'POST',headers:f.headers,body:'{"title":"Fake announcement","body":"Not authorized"}'},f.env)).status).toBe(403);expect((await app.request('/api/v1/community/admin/discussion/'+id+'/visibility',{method:'PATCH',headers:f.headers,body:'{"hidden":true}'},f.env)).status).toBe(403)}finally{f.close()}});
 it('ranks each user once per published version without exposing identity',async()=>{const f=await fixture();try{
  const now=Math.floor(Date.now()/1000);f.core.prepare('INSERT INTO exams VALUES(?,?,?)').run('exam',id,'Published exam');f.core.prepare("INSERT INTO exam_versions(id,exam_id,version_number,content_hash,status,published_at) VALUES(?,?,1,'hash','published',?)").run(id,'exam',now);
  expect((await app.request('/api/v1/student/attempts/'+attemptId+'/submit',{method:'POST',headers:f.headers,body:JSON.stringify({saveVersion:1,idempotencyKey:attemptId})},f.env)).status).toBe(200);
  f.results.prepare("INSERT INTO attempts(id,user_id,exam_version_id,exam_content_hash,grading_snapshot_json,started_at,expires_at,status,save_version,answer_snapshot_json,updated_at,submitted_at) VALUES('second','user',?,'hash','[]',?,?, 'submitted',0,'{}',?,?)").run(id,now-30,now+30,now,now);
  f.results.prepare("INSERT INTO scores VALUES('second-score','second',0,1,?,'v1')").run(now);
  const read=await app.request('/api/v1/community/leaderboard?versionId='+id,{headers:f.headers},f.env);expect(read.status).toBe(200);const data=await read.json();expect(data.entries).toHaveLength(1);expect(data.entries[0]).toMatchObject({rank:1,isMe:true,points:1,maxPoints:1});expect(JSON.stringify(data)).not.toContain('userId');expect(JSON.stringify(data)).not.toContain('qa@example.com');
 }finally{f.close()}});
 it('hides rankings of unpublished versions and requires a session',async()=>{const f=await fixture();try{expect((await app.request('/api/v1/community/leaderboard?versionId='+id,{headers:f.headers},f.env)).status).toBe(404);expect((await app.request('/api/v1/community/announcements')).status).toBe(401)}finally{f.close()}});
});
