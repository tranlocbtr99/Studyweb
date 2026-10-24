import { Hono } from 'hono';
import { z } from 'zod';
import { requireSession, requireRole, sameOrigin } from './auth';
import type { Env } from './auth';
const admin = new Hono<Env>();
const schema = z.object({slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(64),title:z.string().trim().min(2).max(160)}).strict();
admin.use('*',requireSession,requireRole('admin'));
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
export default admin;
