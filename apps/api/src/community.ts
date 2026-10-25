import {Hono} from 'hono';
import {z} from 'zod';
import {requireSession,requireRole,sameOrigin,sha256} from './auth';
import type {Env} from './auth';
const community=new Hono<Env>();
community.use('*',requireSession);
const uuid=z.string().uuid();
const visible="EXISTS(SELECT 1 FROM learning_lessons l WHERE l.subject_id=s.id AND l.status='published') OR EXISTS(SELECT 1 FROM learning_materials m WHERE m.subject_id=s.id AND m.status='published') OR EXISTS(SELECT 1 FROM exams e JOIN exam_versions v ON v.exam_id=e.id WHERE e.subject_id=s.id AND v.status='published' AND v.published_at IS NOT NULL)";
community.put('/lessons/:id/progress',sameOrigin,async c=>{
 const id=c.req.param('id'),parsed=z.object({completed:z.boolean()}).strict().safeParse(await c.req.json().catch(()=>null));
 if(!uuid.safeParse(id).success||!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{
  const row=await c.env.EXAM_CORE.prepare("SELECT id FROM learning_lessons WHERE id=? AND status='published'").bind(id).first();
  if(!row)return c.json({error:{code:'LESSON_NOT_FOUND'}},404);
  const now=Math.floor(Date.now()/1000);
  await c.env.EXAM_CORE.prepare("INSERT INTO lesson_progress(user_id,lesson_id,completed,updated_at) SELECT ?,id,?,? FROM learning_lessons WHERE id=? AND status='published' ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at").bind(c.get('identity').id,Number(parsed.data.completed),now,id).run();
  return c.json({lessonId:id,completed:parsed.data.completed});
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
community.get('/discussion',async c=>{
 const subjectId=c.req.query('subjectId'),offset=Number(c.req.query('offset')??0);
 if(!uuid.safeParse(subjectId).success||!Number.isInteger(offset)||offset<0||offset>100000)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{
  const subject=await c.env.EXAM_CORE.prepare('SELECT s.id FROM subjects s WHERE s.id=? AND ('+visible+')').bind(subjectId).first();
  if(!subject)return c.json({error:{code:'SUBJECT_NOT_FOUND'}},404);
  const rows=await c.env.EXAM_CORE.prepare('SELECT id,user_id AS userId,body,created_at AS createdAt FROM discussion_posts WHERE subject_id=? AND hidden=0 ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?').bind(subjectId,offset).all();
  const posts=await Promise.all((rows.results as Array<{id:string;userId:string;body:string;createdAt:number}>).map(async row=>({id:row.id,body:row.body,createdAt:row.createdAt,isMe:row.userId===c.get('identity').id,author:'Học viên '+(await sha256(row.userId)).slice(0,6)})));
  return c.json({posts,offset});
 }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});
community.post('/discussion',sameOrigin,async c=>{
 const parsed=z.object({subjectId:uuid,body:z.string().trim().min(1).max(2000)}).strict().safeParse(await c.req.json().catch(()=>null));
 if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const {subjectId,body}=parsed.data,id=crypto.randomUUID(),now=Math.floor(Date.now()/1000),userId=c.get('identity').id;
 try{
  const subject=await c.env.EXAM_CORE.prepare('SELECT s.id FROM subjects s WHERE s.id=? AND ('+visible+')').bind(subjectId).first();
  if(!subject)return c.json({error:{code:'SUBJECT_NOT_FOUND'}},404);
  const write=await c.env.EXAM_CORE.prepare('INSERT INTO discussion_posts(id,subject_id,user_id,body,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM discussion_posts WHERE user_id=? AND created_at>?)<5').bind(id,subjectId,userId,body,now,userId,now-60).run() as {meta?:{changes?:number}};
  if(write.meta?.changes!==1)return c.json({error:{code:'POST_RATE_LIMITED'}},429);
  return c.json({id},201);
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
community.get('/announcements',async c=>{
 const offset=Number(c.req.query('offset')??0);
 if(!Number.isInteger(offset)||offset<0||offset>100000)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{
  const rows=await c.env.EXAM_CORE.prepare('SELECT a.id,a.title,a.body,a.created_at AS createdAt,CASE WHEN r.read_at IS NULL THEN 0 ELSE 1 END AS isRead FROM announcements a LEFT JOIN announcement_reads r ON r.announcement_id=a.id AND r.user_id=? WHERE a.archived=0 ORDER BY a.created_at DESC,a.id DESC LIMIT 20 OFFSET ?').bind(c.get('identity').id,offset).all();
  const count=await c.env.EXAM_CORE.prepare('SELECT COUNT(*) AS unread FROM announcements a WHERE a.archived=0 AND NOT EXISTS(SELECT 1 FROM announcement_reads r WHERE r.announcement_id=a.id AND r.user_id=?)').bind(c.get('identity').id).first<{unread:number}>();
  return c.json({announcements:rows.results,unread:count?.unread??0});
 }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});
community.put('/announcements/:id/read',sameOrigin,async c=>{
 const id=c.req.param('id');if(!uuid.safeParse(id).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{
  const row=await c.env.EXAM_CORE.prepare('SELECT id FROM announcements WHERE id=? AND archived=0').bind(id).first();
  if(!row)return c.json({error:{code:'NOT_FOUND'}},404);
  await c.env.EXAM_CORE.prepare('INSERT INTO announcement_reads(user_id,announcement_id,read_at) VALUES(?,?,?) ON CONFLICT(user_id,announcement_id) DO UPDATE SET read_at=excluded.read_at').bind(c.get('identity').id,id,Math.floor(Date.now()/1000)).run();return c.json({read:true});
 }catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
community.get('/leaderboard',async c=>{
 const versionId=c.req.query('versionId');if(!uuid.safeParse(versionId).success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{
  const version=await c.env.EXAM_CORE.prepare("SELECT id FROM exam_versions WHERE id=? AND status='published' AND published_at IS NOT NULL").bind(versionId).first();
  if(!version)return c.json({error:{code:'NOT_FOUND'}},404);
  const result=await c.env.EXAM_RESULTS.prepare("SELECT userId,points,maxPoints,submittedAt FROM (SELECT a.user_id AS userId,s.points,s.max_points AS maxPoints,a.submitted_at AS submittedAt,ROW_NUMBER() OVER(PARTITION BY a.user_id ORDER BY s.points DESC,a.submitted_at ASC,a.id ASC) AS best FROM attempts a JOIN scores s ON s.attempt_id=a.id WHERE a.exam_version_id=? AND a.status='submitted') WHERE best=1 ORDER BY points DESC,submittedAt ASC,userId LIMIT 50").bind(versionId).all();
  const entries=await Promise.all((result.results as Array<{userId:string;points:number;maxPoints:number;submittedAt:number}>).map(async(row,index)=>({rank:index+1,alias:'Học viên '+(await sha256(row.userId)).slice(0,6),isMe:row.userId===c.get('identity').id,points:row.points,maxPoints:row.maxPoints,submittedAt:row.submittedAt})));
  return c.json({entries,rule:'Mỗi học viên lấy điểm cao nhất; bằng điểm ưu tiên nộp sớm. Tối đa 50 học viên.'});
 }catch{return c.json({error:{code:'READ_FAILED'}},503);}
});
community.get('/admin/announcements',requireRole('admin'),async c=>{
 const offset=Number(c.req.query('offset')??0);if(!Number.isInteger(offset)||offset<0||offset>100000)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{const rows=await c.env.EXAM_CORE.prepare('SELECT id,title,body,archived,created_at AS createdAt FROM announcements ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?').bind(offset).all();return c.json({announcements:rows.results,unread:0})}catch{return c.json({error:{code:'READ_FAILED'}},503);}
});
community.patch('/admin/announcements/:id',requireRole('admin'),sameOrigin,async c=>{
 const id=c.req.param('id'),parsed=z.object({archived:z.boolean()}).strict().safeParse(await c.req.json().catch(()=>null));if(!uuid.safeParse(id).success||!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{const writes=await c.env.EXAM_CORE.batch([c.env.EXAM_CORE.prepare('UPDATE announcements SET archived=? WHERE id=?').bind(Number(parsed.data.archived),id),c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),c.get('identity').id,parsed.data.archived?'announcement.archived':'announcement.restored',id,Math.floor(Date.now()/1000))]);if((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'NOT_FOUND'}},404);return c.json({archived:parsed.data.archived})}catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
community.get('/admin/discussion',requireRole('admin'),async c=>{
 const subjectId=c.req.query('subjectId'),offset=Number(c.req.query('offset')??0);if(!uuid.safeParse(subjectId).success||!Number.isInteger(offset)||offset<0||offset>100000)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{const rows=await c.env.EXAM_CORE.prepare('SELECT p.id,p.body,p.hidden,p.created_at AS createdAt,u.email AS author FROM discussion_posts p JOIN users u ON u.id=p.user_id WHERE subject_id=? ORDER BY p.created_at DESC,p.id DESC LIMIT 20 OFFSET ?').bind(subjectId,offset).all();return c.json({posts:rows.results})}catch{return c.json({error:{code:'READ_FAILED'}},503);}
});
community.post('/admin/announcements',requireRole('admin'),sameOrigin,async c=>{
 const parsed=z.object({title:z.string().trim().min(2).max(160),body:z.string().trim().min(1).max(5000)}).strict().safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000);
 try{await c.env.EXAM_CORE.batch([c.env.EXAM_CORE.prepare('INSERT INTO announcements(id,title,body,author_id,created_at) VALUES(?,?,?,?,?)').bind(id,parsed.data.title,parsed.data.body,c.get('identity').id,now),c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),c.get('identity').id,'announcement.created',id,now)]);return c.json({id},201)}catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
community.patch('/admin/discussion/:id/visibility',requireRole('admin'),sameOrigin,async c=>{
 const id=c.req.param('id'),parsed=z.object({hidden:z.boolean()}).strict().safeParse(await c.req.json().catch(()=>null));if(!uuid.safeParse(id).success||!parsed.success)return c.json({error:{code:'VALIDATION_FAILED'}},400);
 try{const writes=await c.env.EXAM_CORE.batch([c.env.EXAM_CORE.prepare('UPDATE discussion_posts SET hidden=? WHERE id=?').bind(Number(parsed.data.hidden),id),c.env.EXAM_CORE.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),c.get('identity').id,parsed.data.hidden?'discussion.hidden':'discussion.restored',id,Math.floor(Date.now()/1000))]);if((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes!==1)return c.json({error:{code:'NOT_FOUND'}},404);return c.json({hidden:parsed.data.hidden})}catch{return c.json({error:{code:'WRITE_FAILED'}},503);}
});
export default community;
