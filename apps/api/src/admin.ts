import { Hono } from 'hono';
import { z } from 'zod';
import { requireSession, requireRole, sameOrigin } from './auth';
import type { Env } from './auth';
import { examContentHash } from './exam-integrity';
const admin = new Hono<Env>();
const schema = z.object({slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(64).optional(),title:z.string().trim().min(2).max(160)}).strict();
admin.use('*',requireSession,requireRole('admin'));



const lessonInput=z.object({subjectId:z.string().uuid(),title:z.string().trim().min(2).max(160),body:z.string().max(30000),position:z.number().int().min(0).max(10000),status:z.enum(['draft','published'])}).strict();
const materialInput=z.object({subjectId:z.string().uuid(),title:z.string().trim().min(2).max(160),description:z.string().max(2000),url:z.url().max(2048).refine(url=>url.startsWith('https://')),status:z.enum(['draft','published'])}).strict();
admin.post('/learning/lessons',sameOrigin,async c=>{
 const parsed=lessonInput.safeParse(await c.req.json().catch(()=>null));
 if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const {subjectId,title,body,position,status}=parsed.data;
 const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000);
 try{
  const subject=await c.env.EXAM_CORE.prepare('SELECT id FROM subjects WHERE id=?').bind(subjectId).first();
  if(!subject)return c.json({error:{code:'SUBJECT_NOT_FOUND'}},404);
  await c.env.EXAM_CORE.prepare('INSERT INTO learning_lessons(id,subject_id,title,body,position,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,subjectId,title,body,position,status,now,now).run();
  return c.json({id},201);
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
admin.post('/learning/materials',sameOrigin,async c=>{
 const parsed=materialInput.safeParse(await c.req.json().catch(()=>null));
 if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const {subjectId,title,description,url,status}=parsed.data;
 const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000);
 try{
  const subject=await c.env.EXAM_CORE.prepare('SELECT id FROM subjects WHERE id=?').bind(subjectId).first();
  if(!subject)return c.json({error:{code:'SUBJECT_NOT_FOUND'}},404);
  await c.env.EXAM_CORE.prepare('INSERT INTO learning_materials(id,subject_id,title,description,url,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,subjectId,title,description,url,status,now,now).run();
  return c.json({id},201);
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});



const learningStatusInput=z.object({status:z.enum(['draft','archived'])}).strict();
admin.patch('/learning/:kind/:id/status',sameOrigin,async c=>{
 const kind=c.req.param('kind'),id=c.req.param('id');
 const parsed=learningStatusInput.safeParse(await c.req.json().catch(()=>null));
 if(!['lessons','materials'].includes(kind)||!z.string().uuid().safeParse(id).success||!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const table=kind==='lessons'?'learning_lessons':'learning_materials';
 const now=Math.floor(Date.now()/1000),status=parsed.data.status;
 try{
  const writes=await c.env.EXAM_CORE.batch([
   c.env.EXAM_CORE.prepare('UPDATE '+table+' SET status=?,updated_at=? WHERE id=? AND '+(status==='draft'?"status='archived'":"status IN ('draft','published')")).bind(status,now,id),
   c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),c.get('identity').id,'learning.'+kind+'.'+(status==='draft'?'restored':'archived'),id,now)
  ]);
  if((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'CONTENT_STATUS_CONFLICT'}},409);
  return c.json({id,status});
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});

const learningListInput=z.object({subjectId:z.string().uuid(),kind:z.enum(['lesson','material']),offset:z.coerce.number().int().min(0).max(100000).default(0),status:z.enum(['all','draft','published','archived']).default('all'),search:z.string().trim().max(160).default('')});
admin.get('/learning',async c=>{
 const parsed=learningListInput.safeParse(c.req.query());
 if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const {subjectId,kind,offset,status,search}=parsed.data;
 const table=kind==='lesson'?'learning_lessons':'learning_materials';
 const fields=kind==='lesson'?'body,position':"description AS body,url";
 const filter=" WHERE subject_id=? AND (?='all' OR status=?) AND (?='' OR instr(lower(title),lower(?))>0)";
 try{
  const rows=await c.env.EXAM_CORE.prepare('SELECT id,subject_id AS subjectId,title,status,updated_at AS updatedAt,'+fields+' FROM '+table+filter+' ORDER BY updated_at DESC,id LIMIT 20 OFFSET ?').bind(subjectId,status,status,search,search,offset).all();
  const count=await c.env.EXAM_CORE.prepare('SELECT COUNT(*) AS total FROM '+table+filter).bind(subjectId,status,status,search,search).first<{total:number}>();
  return c.json({items:rows.results,total:count?.total??0,offset});
 }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});
admin.put('/learning/:kind/:id',sameOrigin,async c=>{
 const kind=c.req.param('kind'),id=c.req.param('id');
 if(!['lessons','materials'].includes(kind)||!z.string().uuid().safeParse(id).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const input=await c.req.json().catch(()=>null);
 const now=Math.floor(Date.now()/1000);
 try{
  const parsed=kind==='lessons'?lessonInput.safeParse(input):materialInput.safeParse(input);
  if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  const data=parsed.data;
  const subject=await c.env.EXAM_CORE.prepare('SELECT id FROM subjects WHERE id=?').bind(data.subjectId).first();
  if(!subject)return c.json({error:{code:'SUBJECT_NOT_FOUND'}},404);
  const statement='body' in data
   ?c.env.EXAM_CORE.prepare('UPDATE learning_lessons SET title=?,body=?,position=?,status=?,updated_at=? WHERE id=? AND subject_id=?').bind(data.title,data.body,data.position,data.status,now,id,data.subjectId)
   :c.env.EXAM_CORE.prepare('UPDATE learning_materials SET title=?,description=?,url=?,status=?,updated_at=? WHERE id=? AND subject_id=?').bind(data.title,data.description,data.url,data.status,now,id,data.subjectId);
  const writes=await c.env.EXAM_CORE.batch([
   statement,
   c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),c.get('identity').id,'learning.'+kind+'.updated',id,now)
  ]);
  if((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'CONTENT_NOT_FOUND'}},404);
  return c.json({id,updated:true});
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});

admin.get('/results',async c=>{
 const parsed=z.object({offset:z.coerce.number().int().min(0).max(100000).default(0),status:z.enum(['all','submitted','active','expired']).default('all')}).safeParse(c.req.query());
 if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const {offset,status}=parsed.data,now=Math.floor(Date.now()/1000);
 const normalized="CASE WHEN a.status='active' AND a.expires_at<=? THEN 'expired' ELSE a.status END";
 try{
  const rows=await c.env.EXAM_RESULTS.prepare('SELECT a.id,a.user_id AS userId,a.exam_version_id AS versionId,a.started_at AS startedAt,a.submitted_at AS submittedAt,'+normalized+' AS status,s.points,s.max_points AS maxPoints FROM attempts a LEFT JOIN scores s ON s.attempt_id=a.id WHERE (?=\'all\' OR '+normalized+'=?) ORDER BY a.started_at DESC,a.id DESC LIMIT 20 OFFSET ?').bind(now,status,now,status,offset).all();
  const count=await c.env.EXAM_RESULTS.prepare('SELECT COUNT(*) AS total FROM attempts a WHERE (?=\'all\' OR '+normalized+'=?)').bind(status,now,status).first<{total:number}>();
  const entries=rows.results as Array<{id:string;userId:string;versionId:string;status:string}>;
  const userIds=[...new Set(entries.map(row=>row.userId))],versionIds=[...new Set(entries.map(row=>row.versionId))];
  const users=userIds.length?await c.env.EXAM_CORE.prepare('SELECT id,email FROM users WHERE id IN ('+userIds.map(()=>'?').join(',')+')').bind(...userIds).all():{results:[]};
  const exams=versionIds.length?await c.env.EXAM_CORE.prepare('SELECT v.id,e.title FROM exam_versions v JOIN exams e ON e.id=v.exam_id WHERE v.id IN ('+versionIds.map(()=>'?').join(',')+')').bind(...versionIds).all():{results:[]};
  const emails=new Map((users.results as Array<{id:string;email:string}>).map(row=>[row.id,row.email]));
  const titles=new Map((exams.results as Array<{id:string;title:string}>).map(row=>[row.id,row.title]));
  return c.json({results:entries.map(row=>({...row,email:emails.get(row.userId)??'Tài khoản không còn tồn tại',examTitle:titles.get(row.versionId)??'Đề thi không còn trong danh mục'})),total:count?.total??0,offset});
 }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});

admin.get('/analytics',async c=>{
 const since=Math.floor(Date.now()/1000)-7*86400;
 try{
  const daily=await c.env.EXAM_RESULTS.prepare("SELECT date(started_at,'unixepoch','+7 hours') AS day,COUNT(*) AS count FROM attempts WHERE started_at>=? GROUP BY day ORDER BY day").bind(since).all();
  const statuses=await c.env.EXAM_RESULTS.prepare("SELECT CASE WHEN status='active' AND expires_at<=? THEN 'expired' ELSE status END AS status,COUNT(*) AS count FROM attempts GROUP BY 1").bind(Math.floor(Date.now()/1000)).all();
  const activity=await c.env.EXAM_CORE.prepare('SELECT a.id,a.action,a.created_at AS createdAt,u.email FROM core_audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC,a.id DESC LIMIT 6').all();
  return c.json({daily:daily.results,statuses:statuses.results,activity:activity.results});
 }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});

admin.get('/overview',async c=>{
 try{
  const core=await c.env.EXAM_CORE.prepare("SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM subjects) AS subjects,(SELECT COUNT(*) FROM questions) AS questions,(SELECT COUNT(*) FROM exams) AS exams,(SELECT COUNT(*) FROM exam_versions WHERE status='published') AS publishedVersions").first<{users:number;subjects:number;questions:number;exams:number;publishedVersions:number}>();
  return c.json({overview:core??{users:0,subjects:0,questions:0,exams:0,publishedVersions:0}});
 }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});

admin.get('/users',async c=>{
 const search=(c.req.query('search')??'').trim();
 const offset=Number(c.req.query('offset')??0);
 const status=c.req.query('status')??'all';
 const removed=c.req.query('removed')==='true';
 const order=c.req.query('order')??'newest';
 if(search.length>120||!['all','active','disabled'].includes(status)||!['newest','oldest'].includes(order)||!Number.isInteger(offset)||offset<0||offset>100000)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{
  const filter=" WHERE deleted_at IS "+(removed?'NOT NULL':'NULL')+" AND (?='' OR instr(lower(email),lower(?))>0) AND (?='all' OR status=?)";
  const ordering=order==='newest'?'DESC':'ASC';
  const rows=await c.env.EXAM_CORE.prepare("SELECT id,email,status,deleted_at AS deletedAt,created_at AS createdAt,(SELECT GROUP_CONCAT(r.code,',') FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=users.id) AS roles FROM users"+filter+" ORDER BY created_at "+ordering+",id "+ordering+" LIMIT 20 OFFSET ?").bind(search,search,status,status,offset).all();
  const count=await c.env.EXAM_CORE.prepare("SELECT COUNT(*) AS total FROM users"+filter).bind(search,search,status,status).first<{total:number}>();
  return c.json({users:rows.results,offset,total:count?.total??0});
 }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});

// Removal is recoverable and immediately blocks new and existing sessions.
admin.delete('/users/:id',sameOrigin,async c=>{
 const id=c.req.param('id');if(!z.string().uuid().safeParse(id).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 if(id===c.get('identity').id)return c.json({error:{code:'CANNOT_REMOVE_SELF'}},409);
 const now=Math.floor(Date.now()/1000);
 try{
  const target=await c.env.EXAM_CORE.prepare("SELECT u.id FROM users u WHERE u.id=? AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='student') AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code<>'student')").bind(id).first();
  if(!target)return c.json({error:{code:'STUDENT_NOT_REMOVABLE'}},409);
  const writes=await c.env.EXAM_CORE.batch([
   c.env.EXAM_CORE.prepare("UPDATE users SET deleted_at=?,deleted_previous_status=status,status='disabled' WHERE id=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=users.id AND r.code='student') AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=users.id AND r.code<>'student')").bind(now,id),
   c.env.EXAM_CORE.prepare("INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,'student.removed',?,? WHERE changes()=1").bind(crypto.randomUUID(),c.get('identity').id,id,now),
   c.env.EXAM_CORE.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM users WHERE id=? AND deleted_at IS NOT NULL)').bind(now,id,id)
  ]);
  if((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'STUDENT_NOT_REMOVABLE'}},409);
  return c.json({removed:true,recoverable:true});
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
admin.post('/users/:id/restore',sameOrigin,async c=>{
 const id=c.req.param('id');if(!z.string().uuid().safeParse(id).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{const writes=await c.env.EXAM_CORE.batch([
 c.env.EXAM_CORE.prepare("UPDATE users SET deleted_at=NULL,status=COALESCE(deleted_previous_status,'disabled'),deleted_previous_status=NULL WHERE id=? AND deleted_at IS NOT NULL AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=users.id AND r.code='student') AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=users.id AND r.code<>'student')").bind(id),
 c.env.EXAM_CORE.prepare("INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,'student.restored',?,? WHERE changes()=1").bind(crypto.randomUUID(),c.get('identity').id,id,Math.floor(Date.now()/1000))]);
 if((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'STUDENT_NOT_RESTORABLE'}},409);return c.json({restored:true});
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});

// Read-only authoring catalogs let administrators resume work across browser sessions.
admin.get('/subjects', async c => {
  try {
    const result=await c.env.EXAM_CORE.prepare('SELECT id,slug,title FROM subjects ORDER BY title LIMIT 500').all();
    return c.json({subjects:result.results});
  } catch {return c.json({error:{code:'READ_FAILED'}},503);}
});
admin.get('/topics', async c => {
  const subjectId=c.req.query('subjectId');
  if(!subjectId||!z.string().uuid().safeParse(subjectId).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  try {
    const result=await c.env.EXAM_CORE.prepare('SELECT id,subject_id AS subjectId,title FROM topics WHERE subject_id=? ORDER BY title LIMIT 500').bind(subjectId).all();
    return c.json({topics:result.results});
  } catch {return c.json({error:{code:'READ_FAILED'}},503);}
});

admin.post('/subjects',sameOrigin,async c=>{
 let input:unknown;
 try { input=await c.req.json(); } catch { return c.json({error:{code:'BAD_JSON'}},400); }
 const parsed=schema.safeParse(input);
 if(!parsed.success) return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const {title}=parsed.data;
 const id=crypto.randomUUID();
 const slug=parsed.data.slug??((title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45)||'mon-hoc')+'-'+id.slice(0,8));
 try {
  if(!parsed.data.slug){const existing=await c.env.EXAM_CORE.prepare('SELECT id,slug,title FROM subjects WHERE title=? COLLATE NOCASE LIMIT 1').bind(title).first();if(existing)return c.json({subject:existing},200)}
  await c.env.EXAM_CORE.batch([
   c.env.EXAM_CORE.prepare('INSERT INTO subjects(id,slug,title) VALUES(?,?,?)').bind(id,slug,title),
   c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),c.get('identity').id,'subject.created',id,Math.floor(Date.now()/1000))
  ]);
  return c.json({subject:{id,slug,title}},201);
 } catch { return c.json({error:{code:'WRITE_FAILED'}},503); }
});
const topicSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().trim().min(2).max(160)
}).strict();
admin.post('/topics', sameOrigin, async c => {
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  const { subjectId, title } = parsed.data;
  try {
    const subject = await c.env.EXAM_CORE.prepare('SELECT id FROM subjects WHERE id=?').bind(subjectId).first();
    if (!subject) return c.json({ error: { code: 'SUBJECT_NOT_FOUND' } }, 404);
    const id = crypto.randomUUID();
    await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare('INSERT INTO topics(id,subject_id,title) VALUES(?,?,?)').bind(id,subjectId,title),
      c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)')
        .bind(crypto.randomUUID(),c.get('identity').id,'topic.created',id,Math.floor(Date.now()/1000))
    ]);
    return c.json({ topic: { id, subjectId, title } }, 201);
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
});


const listQuestionsSchema = z.object({
  subjectId: z.string().uuid().optional(),
  search: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(100000).default(0)
});
admin.get('/questions', async c => {
  const parsed = listQuestionsSchema.safeParse({
    subjectId: c.req.query('subjectId'),
    search: c.req.query('search') ?? '',
    limit: c.req.query('limit') ?? '30',
    offset: c.req.query('offset') ?? '0'
  });
  if (!parsed.success) return c.json({error:{code:'VALIDATION_FAILED'}},400);
  const {subjectId,search,limit,offset}=parsed.data;
  try {
    const where = "WHERE (? IS NULL OR t.subject_id=?) AND (?='' OR instr(lower(d.body),lower(?))>0)";
    const sql = "SELECT q.id,q.topic_id AS topicId,t.subject_id AS subjectId,q.status,t.title AS topicTitle,d.body,d.correct_option AS correctOption,d.explanation FROM questions q JOIN question_drafts d ON d.question_id=q.id JOIN topics t ON t.id=q.topic_id "+where+" ORDER BY q.rowid DESC LIMIT ? OFFSET ?";
    const result = await c.env.EXAM_CORE.prepare(sql).bind(subjectId??null,subjectId??null,search,search,limit,offset).all();
    const rows = result.results as Array<{id:string;topicId:string;subjectId:string;status:string;body:string;correctOption:string;explanation:string}>;
    const items = await Promise.all(rows.map(async row=>{
      const options = await c.env.EXAM_CORE.prepare('SELECT stable_option_id AS label,body AS text FROM question_options WHERE question_id=? ORDER BY stable_option_id').bind(row.id).all();
      return {...row,options:options.results};
    }));
    return c.json({questions:items,limit,offset});
  } catch {
    return c.json({error:{code:'READ_FAILED'}},503);
  }
});


const updateQuestionSchema=z.object({
  body:z.string().trim().min(5).max(4000),
  options:z.array(z.string().trim().min(1).max(1000)).length(4),
  correctOption:z.enum(['A','B','C','D']),
  explanation:z.string().trim().max(4000)
}).strict();
admin.put('/questions/:id',sameOrigin,async c=>{
  const id=c.req.param('id');
  if(!z.string().uuid().safeParse(id).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  let input:unknown;
  try{input=await c.req.json();}catch{return c.json({error:{code:'BAD_JSON'}},400);}
  const parsed=updateQuestionSchema.safeParse(input);
  if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  try{
    const existing=await c.env.EXAM_CORE.prepare("SELECT id FROM questions WHERE id=? AND status='draft'").bind(id).first();
    if(!existing)return c.json({error:{code:'QUESTION_NOT_EDITABLE'}},409);
    const {body,options,correctOption,explanation}=parsed.data;
    const labels=['A','B','C','D'];
    await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare("UPDATE question_drafts SET body=?,correct_option=?,explanation=? WHERE question_id=? AND EXISTS(SELECT 1 FROM questions WHERE id=? AND status='draft')").bind(body,correctOption,explanation,id,id),
      ...options.map((option,i)=>c.env.EXAM_CORE.prepare("UPDATE question_options SET body=? WHERE question_id=? AND stable_option_id=?").bind(option,id,labels[i])),
      c.env.EXAM_CORE.prepare("INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),c.get('identity').id,'question.updated',id,Math.floor(Date.now()/1000))
    ]);
    // Existing exam_items retain their own immutable snapshots.
    return c.json({question:{id,body,options:options.map((text,i)=>({label:labels[i],text})),correctOption,explanation}});
  }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});

const questionSchema = z.object({
  topicId: z.string().uuid(),
  body: z.string().trim().min(5).max(4000),
  options: z.array(z.string().trim().min(1).max(1000)).length(4),
  correctOption: z.enum(['A','B','C','D']),
  explanation: z.string().trim().max(4000).default('')
}).strict();
admin.post('/questions', sameOrigin, async c => {
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  const { topicId, body, options, correctOption, explanation } = parsed.data;
  try {
    const topic = await c.env.EXAM_CORE.prepare('SELECT id FROM topics WHERE id=?').bind(topicId).first();
    if (!topic) return c.json({ error: { code: 'TOPIC_NOT_FOUND' } }, 404);
    const id = crypto.randomUUID();
    const labels = ['A','B','C','D'] as const;
    await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare("INSERT INTO questions(id,topic_id,status) VALUES(?,?,'draft')").bind(id,topicId),
      c.env.EXAM_CORE.prepare('INSERT INTO question_drafts(question_id,body,correct_option,explanation) VALUES(?,?,?,?)')
        .bind(id,body,correctOption,explanation),
      ...options.map((option,index) =>
        c.env.EXAM_CORE.prepare('INSERT INTO question_options(id,question_id,stable_option_id,body) VALUES(?,?,?,?)')
          .bind(crypto.randomUUID(),id,labels[index],option)),
      c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)')
        .bind(crypto.randomUUID(),c.get('identity').id,'question.created',id,Math.floor(Date.now()/1000))
    ]);
    // Never include correctOption or explanation in student-facing responses.
    return c.json({ question: { id, topicId, body, options: options.map((text,index)=>({label:labels[index],text})), status:'draft' } }, 201);
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
});



const editQuestionSchema=questionSchema.omit({topicId:true}).strict();
admin.put('/questions/:id',sameOrigin,async c=>{
  const id=c.req.param('id');
  if(!z.string().uuid().safeParse(id).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  let input:unknown;
  try{input=await c.req.json();}catch{return c.json({error:{code:'BAD_JSON'}},400);}
  const parsed=editQuestionSchema.safeParse(input);
  if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  const {body,options,correctOption,explanation}=parsed.data;
  try{
    const question=await c.env.EXAM_CORE.prepare("SELECT id FROM questions WHERE id=? AND status='draft'").bind(id).first();
    if(!question)return c.json({error:{code:'QUESTION_NOT_EDITABLE'}},409);
    const writes=await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare("UPDATE question_drafts SET body=?,correct_option=?,explanation=? WHERE question_id=? AND EXISTS(SELECT 1 FROM questions WHERE id=? AND status='draft')").bind(body,correctOption,explanation,id,id),
      ...options.map((value,index)=>c.env.EXAM_CORE.prepare("UPDATE question_options SET body=? WHERE question_id=? AND stable_option_id=?").bind(value,id,['A','B','C','D'][index])),
      c.env.EXAM_CORE.prepare("INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),c.get('identity').id,'question.updated',id,Math.floor(Date.now()/1000))
    ]);
    if((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'QUESTION_NOT_EDITABLE'}},409);
    return c.json({question:{id,body,options:options.map((text,index)=>({label:['A','B','C','D'][index],text})),correctOption,explanation}});
  }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});

const listExamsSchema=z.object({subjectId:z.string().uuid().optional()});
admin.get('/exams',async c=>{
  const parsed=listExamsSchema.safeParse({subjectId:c.req.query('subjectId')});
  if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  try{
    const result=await c.env.EXAM_CORE.prepare("SELECT e.id,e.subject_id AS subjectId,e.title,v.id AS versionId,v.version_number AS versionNumber,v.status,v.duration_minutes AS durationMinutes,(SELECT COUNT(*) FROM exam_items i WHERE i.exam_version_id=v.id) AS questionCount FROM exams e LEFT JOIN exam_versions v ON v.exam_id=e.id WHERE (? IS NULL OR e.subject_id=?) ORDER BY e.rowid DESC,v.version_number DESC LIMIT 200").bind(parsed.data.subjectId??null,parsed.data.subjectId??null).all();
    return c.json({exams:result.results});
  }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});

const examSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().trim().min(3).max(160)
}).strict();
admin.post('/exams', sameOrigin, async c => {
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = examSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  const { subjectId, title } = parsed.data;
  try {
    const subject = await c.env.EXAM_CORE.prepare('SELECT id FROM subjects WHERE id=?').bind(subjectId).first();
    if (!subject) return c.json({ error: { code: 'SUBJECT_NOT_FOUND' } }, 404);
    const id = crypto.randomUUID();
    await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare('INSERT INTO exams(id,subject_id,title) VALUES(?,?,?)').bind(id,subjectId,title),
      c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)')
        .bind(crypto.randomUUID(),c.get('identity').id,'exam.created',id,Math.floor(Date.now()/1000))
    ]);
    return c.json({ exam: { id, subjectId, title } }, 201);
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
});

const versionSchema = z.object({ examId: z.string().uuid(), durationMinutes:z.number().int().min(5).max(240).default(90) }).strict();
admin.post('/exam-versions', sameOrigin, async c => {
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = versionSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  const { examId,durationMinutes } = parsed.data;
  try {
    const exam = await c.env.EXAM_CORE.prepare('SELECT id FROM exams WHERE id=?').bind(examId).first();
    if (!exam) return c.json({ error: { code: 'EXAM_NOT_FOUND' } }, 404);
    const id = crypto.randomUUID();
    // Version allocation happens inside SQLite to avoid a read-then-write race.
    await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare(
        "INSERT INTO exam_versions(id,exam_id,version_number,content_hash,status,duration_minutes) SELECT ?,?,COALESCE(MAX(version_number),0)+1,?,'draft',? FROM exam_versions WHERE exam_id=?"
      ).bind(id,examId,'',durationMinutes,examId),
      c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)')
        .bind(crypto.randomUUID(),c.get('identity').id,'exam_version.created',id,Math.floor(Date.now()/1000))
    ]);
    return c.json({ version: { id, examId, status: 'draft',durationMinutes } }, 201);
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
});


const durationSchema=z.object({durationMinutes:z.number().int().min(5).max(240)}).strict();
admin.patch('/exam-versions/:id/duration',sameOrigin,async c=>{
  const id=c.req.param('id');
  if(!z.string().uuid().safeParse(id).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  let input:unknown;
  try{input=await c.req.json();}catch{return c.json({error:{code:'BAD_JSON'}},400);}
  const parsed=durationSchema.safeParse(input);
  if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  try{
    const writes=await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare("UPDATE exam_versions SET duration_minutes=? WHERE id=? AND status='draft' AND published_at IS NULL").bind(parsed.data.durationMinutes,id),
      c.env.EXAM_CORE.prepare("INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM exam_versions WHERE id=? AND status='draft' AND duration_minutes=?)").bind(crypto.randomUUID(),c.get('identity').id,'exam_version.duration_updated',id,Math.floor(Date.now()/1000),id,parsed.data.durationMinutes)
    ]);
    if((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'VERSION_NOT_DRAFT'}},409);
    return c.json({versionId:id,durationMinutes:parsed.data.durationMinutes});
  }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});

admin.get('/exam-versions/:id/items',async c=>{
  const versionId=c.req.param('id');
  if(!z.string().uuid().safeParse(versionId).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  try{
    const version=await c.env.EXAM_CORE.prepare('SELECT id,status,duration_minutes AS durationMinutes FROM exam_versions WHERE id=?').bind(versionId).first<{id:string;status:string}>();
    if(!version)return c.json({error:{code:'VERSION_NOT_FOUND'}},404);
    const result=await c.env.EXAM_CORE.prepare('SELECT id,position,question_snapshot_json AS snapshot FROM exam_items WHERE exam_version_id=? ORDER BY position LIMIT 1000').bind(versionId).all();
    return c.json({version,items:(result.results as Array<{id:string;position:number;snapshot:string}>).map(row=>{
      const question=JSON.parse(row.snapshot) as {body:string;options:Array<{label:string;text:string}>};
      return {id:row.id,position:row.position,body:question.body,options:question.options};
    })});
  }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});


const editItemSchema=z.object({versionId:z.string().uuid(),itemId:z.string().uuid()});
admin.delete('/exam-items/:id',sameOrigin,async c=>{
  const parsed=editItemSchema.safeParse({versionId:c.req.query('versionId'),itemId:c.req.param('id')});
  if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  const {versionId,itemId}=parsed.data;
  try{
    const item=await c.env.EXAM_CORE.prepare("SELECT i.position FROM exam_items i JOIN exam_versions v ON v.id=i.exam_version_id WHERE i.id=? AND i.exam_version_id=? AND v.status='draft' AND v.published_at IS NULL").bind(itemId,versionId).first<{position:number}>();
    if(!item)return c.json({error:{code:'ITEM_NOT_EDITABLE'}},409);
    const result=await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare("DELETE FROM exam_items WHERE id=? AND exam_version_id=? AND EXISTS(SELECT 1 FROM exam_versions WHERE id=? AND status='draft' AND published_at IS NULL)").bind(itemId,versionId,versionId),
      c.env.EXAM_CORE.prepare("UPDATE exam_items SET position=position+1001 WHERE exam_version_id=? AND position>?").bind(versionId,item.position),
      c.env.EXAM_CORE.prepare("UPDATE exam_items SET position=position-1002 WHERE exam_version_id=? AND position>=1001").bind(versionId),
      c.env.EXAM_CORE.prepare("INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),c.get('identity').id,'exam_item.deleted',itemId,Math.floor(Date.now()/1000))
    ]);
    if((result as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'ITEM_NOT_EDITABLE'}},409);
    return c.json({deleted:true});
  }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
const moveItemSchema=z.object({versionId:z.string().uuid(),direction:z.enum(['up','down'])}).strict();
admin.patch('/exam-items/:id/move',sameOrigin,async c=>{
  const itemId=c.req.param('id');
  if(!z.string().uuid().safeParse(itemId).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  let input:unknown;try{input=await c.req.json();}catch{return c.json({error:{code:'BAD_JSON'}},400);}
  const parsed=moveItemSchema.safeParse(input);
  if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
  const {versionId,direction}=parsed.data;
  try{
    const item=await c.env.EXAM_CORE.prepare("SELECT i.position FROM exam_items i JOIN exam_versions v ON v.id=i.exam_version_id WHERE i.id=? AND i.exam_version_id=? AND v.status='draft' AND v.published_at IS NULL").bind(itemId,versionId).first<{position:number}>();
    if(!item)return c.json({error:{code:'ITEM_NOT_EDITABLE'}},409);
    const target=item.position+(direction==='up'?-1:1);
    const neighbor=await c.env.EXAM_CORE.prepare('SELECT id FROM exam_items WHERE exam_version_id=? AND position=?').bind(versionId,target).first<{id:string}>();
    if(!neighbor)return c.json({error:{code:'NO_ADJACENT_ITEM'}},409);
    await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare('UPDATE exam_items SET position=1001 WHERE id=? AND exam_version_id=?').bind(itemId,versionId),
      c.env.EXAM_CORE.prepare('UPDATE exam_items SET position=? WHERE id=? AND exam_version_id=?').bind(item.position,neighbor.id,versionId),
      c.env.EXAM_CORE.prepare('UPDATE exam_items SET position=? WHERE id=? AND exam_version_id=?').bind(target,itemId,versionId),
      c.env.EXAM_CORE.prepare("INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),c.get('identity').id,'exam_item.moved',itemId,Math.floor(Date.now()/1000))
    ]);
    return c.json({moved:true});
  }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});

const examItemSchema = z.object({
  versionId: z.string().uuid(),
  questionId: z.string().uuid(),
  position: z.number().int().min(0).max(999)
}).strict();
admin.post('/exam-items', sameOrigin, async c => {
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = examItemSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  const { versionId, questionId, position } = parsed.data;
  try {
    const version = await c.env.EXAM_CORE.prepare(
      "SELECT v.id, e.subject_id AS subjectId FROM exam_versions v JOIN exams e ON e.id=v.exam_id WHERE v.id=? AND v.status='draft' AND v.published_at IS NULL"
    ).bind(versionId).first<{ id: string; subjectId: string }>();
    if (!version) return c.json({ error: { code: 'VERSION_NOT_DRAFT' } }, 409);
    const question = await c.env.EXAM_CORE.prepare(
      "SELECT q.id, d.body, d.correct_option AS correctOption, d.explanation FROM questions q JOIN question_drafts d ON d.question_id=q.id JOIN topics t ON t.id=q.topic_id WHERE q.id=? AND t.subject_id=? AND q.status IN ('draft','active')"
    ).bind(questionId,version.subjectId).first<{ id: string; body: string; correctOption: string; explanation: string }>();
    if (!question) return c.json({ error: { code: 'QUESTION_NOT_FOUND' } }, 404);
    const optionRows = await c.env.EXAM_CORE.prepare(
      'SELECT stable_option_id AS label, body AS text FROM question_options WHERE question_id=? ORDER BY stable_option_id'
    ).bind(questionId).all();
    const options = optionRows.results as Array<{label:string;text:string}>;
    if (options.length !== 4 || options.some((o,i)=>o.label !== ['A','B','C','D'][i]))
      return c.json({ error: { code: 'INCOMPLETE_QUESTION' } }, 409);
    const snapshot = JSON.stringify({ questionId, body: question.body, options });
    const privateKey = JSON.stringify({ correctOption: question.correctOption, explanation: question.explanation });
    const id = crypto.randomUUID();
    const writes = await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare(
        "INSERT INTO exam_items(id,exam_version_id,position,question_snapshot_json,answer_key_private_json) SELECT ?,id,?,?,? FROM exam_versions WHERE id=? AND status='draft' AND published_at IS NULL"
      ).bind(id,position,snapshot,privateKey,versionId),
      c.env.EXAM_CORE.prepare(
        'INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM exam_items WHERE id=?)'
      ).bind(crypto.randomUUID(),c.get('identity').id,'exam_item.created',id,Math.floor(Date.now()/1000),id)
    ]);
    const inserted = (writes as Array<{ meta?: { changes?: number } }>)[0]?.meta?.changes;
    if (inserted !== 1) return c.json({ error: { code: 'VERSION_NOT_DRAFT' } }, 409);
    return c.json({ item: { id, versionId, position, question: JSON.parse(snapshot) } }, 201);
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
});

const publishSchema = z.object({ versionId: z.string().uuid() }).strict();
admin.post('/publish-exam-version', sameOrigin, async c => {
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  const { versionId } = parsed.data;
  try {
    const version = await c.env.EXAM_CORE.prepare(
      "SELECT id,items_revision AS itemsRevision FROM exam_versions WHERE id=? AND status='draft' AND published_at IS NULL"
    ).bind(versionId).first<{ id: string; itemsRevision: number }>();
    if (!version) return c.json({ error: { code: 'VERSION_NOT_DRAFT' } }, 409);
    const result = await c.env.EXAM_CORE.prepare(
      'SELECT position,question_snapshot_json AS questionSnapshotJson,answer_key_private_json AS answerKeyPrivateJson FROM exam_items WHERE exam_version_id=? ORDER BY position'
    ).bind(versionId).all();
    const items = result.results as import('./exam-integrity').ExamDigestItem[];
    let hash: string;
    try { hash = await examContentHash(items); }
    catch { return c.json({ error: { code: 'INVALID_EXAM_CONTENT' } }, 409); }
    const publishedAt = Math.floor(Date.now()/1000);
    // Conditional UPDATE must affect exactly one row. D1 batch rolls back audit on failure.
    const writes = await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare(
        "UPDATE exam_versions SET content_hash=?,published_at=?,status='published' WHERE id=? AND status='draft' AND published_at IS NULL AND items_revision=? AND (SELECT COUNT(*) FROM exam_items WHERE exam_version_id=?)=?"
      ).bind(hash,publishedAt,versionId,version.itemsRevision,versionId,items.length),
      c.env.EXAM_CORE.prepare(
        "INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE (SELECT status FROM exam_versions WHERE id=?)='published' AND (SELECT content_hash FROM exam_versions WHERE id=?)=?"
      ).bind(crypto.randomUUID(),c.get('identity').id,'exam_version.published',versionId,publishedAt,versionId,versionId,hash)
    ]);
    const changed = (writes as Array<{ meta?: { changes?: number } }>)[0]?.meta?.changes;
    if (changed !== 1) return c.json({ error: { code: 'PUBLISH_CONFLICT' } }, 409);
    return c.json({ version: { id: versionId, status: 'published', contentHash: hash, publishedAt } }, 200);
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
});
export default admin;

