import { Hono } from 'hono';
import { z } from 'zod';
import { requireSession, requireRole, sameOrigin } from './auth';
import type { Env } from './auth';
import { examContentHash } from './exam-integrity';
const admin = new Hono<Env>();
const schema = z.object({slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(64),title:z.string().trim().min(2).max(160)}).strict();
admin.use('*',requireSession,requireRole('admin'));

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
 const {slug,title}=parsed.data;
 const id=crypto.randomUUID();
 try {
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
    const sql = "SELECT q.id,q.topic_id AS topicId,t.subject_id AS subjectId,q.status,d.body,d.correct_option AS correctOption,d.explanation FROM questions q JOIN question_drafts d ON d.question_id=q.id JOIN topics t ON t.id=q.topic_id "+where+" ORDER BY q.rowid DESC LIMIT ? OFFSET ?";
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
    const result=await c.env.EXAM_CORE.prepare("SELECT e.id,e.subject_id AS subjectId,e.title,v.id AS versionId,v.version_number AS versionNumber,v.status,(SELECT COUNT(*) FROM exam_items i WHERE i.exam_version_id=v.id) AS questionCount FROM exams e LEFT JOIN exam_versions v ON v.exam_id=e.id WHERE (? IS NULL OR e.subject_id=?) ORDER BY e.rowid DESC,v.version_number DESC LIMIT 200").bind(parsed.data.subjectId??null,parsed.data.subjectId??null).all();
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

const versionSchema = z.object({ examId: z.string().uuid() }).strict();
admin.post('/exam-versions', sameOrigin, async c => {
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = versionSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  const { examId } = parsed.data;
  try {
    const exam = await c.env.EXAM_CORE.prepare('SELECT id FROM exams WHERE id=?').bind(examId).first();
    if (!exam) return c.json({ error: { code: 'EXAM_NOT_FOUND' } }, 404);
    const id = crypto.randomUUID();
    // Version allocation happens inside SQLite to avoid a read-then-write race.
    await c.env.EXAM_CORE.batch([
      c.env.EXAM_CORE.prepare(
        "INSERT INTO exam_versions(id,exam_id,version_number,content_hash,status) SELECT ?,?,COALESCE(MAX(version_number),0)+1,?,'draft' FROM exam_versions WHERE exam_id=?"
      ).bind(id,examId,'',examId),
      c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)')
        .bind(crypto.randomUUID(),c.get('identity').id,'exam_version.created',id,Math.floor(Date.now()/1000))
    ]);
    return c.json({ version: { id, examId, status: 'draft' } }, 201);
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
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
