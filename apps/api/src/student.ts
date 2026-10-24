import { Hono } from 'hono';
import { z } from 'zod';
import { requireSession, sameOrigin } from './auth';
import { examContentHash } from './exam-integrity';
import type { Env } from './auth';

const student = new Hono<Env>();
student.use('*', requireSession);
const versionId = z.string().uuid();

// Student-facing read model. Never select answer_key_private_json.
student.get('/exam-versions/:versionId', async c => {
  const parsed = versionId.safeParse(c.req.param('versionId'));
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  try {
    const version = await c.env.EXAM_CORE.prepare(
      "SELECT id,exam_id AS examId,version_number AS versionNumber,content_hash AS contentHash FROM exam_versions WHERE id=? AND status='published' AND published_at IS NOT NULL"
    ).bind(parsed.data).first();
    if (!version) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
    const rows = await c.env.EXAM_CORE.prepare(
      'SELECT position,question_snapshot_json AS snapshot FROM exam_items WHERE exam_version_id=? ORDER BY position'
    ).bind(parsed.data).all();
    const questions = (rows.results as Array<{ position: number; snapshot: string }>).map(row => ({
      position: row.position,
      question: JSON.parse(row.snapshot) as unknown
    }));
    return c.json({ version, questions });
  } catch {
    return c.json({ error: { code: 'DB_UNAVAILABLE' } }, 503);
  }
});

const startSchema = z.object({ versionId: z.string().uuid() }).strict();
const attemptDurationSeconds = 90 * 60;
student.post('/attempts', sameOrigin, async c => {
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  try {
    const version = await c.env.EXAM_CORE.prepare(
      "SELECT id,content_hash AS contentHash,items_revision AS itemsRevision FROM exam_versions WHERE id=? AND status='published' AND published_at IS NOT NULL"
    ).bind(parsed.data.versionId).first<{id:string;contentHash:string;itemsRevision:number}>();
    if (!version) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
    const rows = await c.env.EXAM_CORE.prepare(
      'SELECT position,question_snapshot_json AS questionSnapshotJson,answer_key_private_json AS answerKeyPrivateJson FROM exam_items WHERE exam_version_id=? ORDER BY position'
    ).bind(version.id).all();
    const items = rows.results as import('./exam-integrity').ExamDigestItem[];
    let digest: string;
    try { digest = await examContentHash(items); }
    catch { return c.json({ error: { code: 'INVALID_EXAM_CONTENT' } }, 409); }
    if (digest !== version.contentHash) return c.json({ error: { code: 'EXAM_INTEGRITY_MISMATCH' } }, 409);
    const grading = items.map(item => ({
      position: item.position,
      correctOption: (JSON.parse(item.answerKeyPrivateJson) as {correctOption:string}).correctOption
    }));
    const now = Math.floor(Date.now() / 1000);
    const attemptId = crypto.randomUUID();
    await c.env.EXAM_RESULTS.batch([
      c.env.EXAM_RESULTS.prepare(
        "INSERT INTO attempts(id,user_id,exam_version_id,exam_content_hash,grading_snapshot_json,started_at,expires_at,status,save_version,answer_snapshot_json,updated_at) VALUES(?,?,?,?,?,?,?,'active',0,'{}',?)"
      ).bind(attemptId,c.get('identity').id,version.id,digest,JSON.stringify(grading),now,now+attemptDurationSeconds,now),
      c.env.EXAM_RESULTS.prepare(
        'INSERT INTO audit_logs(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)'
      ).bind(crypto.randomUUID(),c.get('identity').id,'attempt.started',attemptId,now)
    ]);
    return c.json({ attempt: { id: attemptId, versionId: version.id, startedAt: now, expiresAt: now+attemptDurationSeconds, saveVersion: 0 } }, 201);
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
});

const saveSchema = z.object({
  saveVersion: z.number().int().min(0),
  answers: z.record(z.string().regex(/^(0|[1-9][0-9]{0,3})$/), z.enum(['A','B','C','D'])).refine(a=>Object.keys(a).length<=1000)
}).strict();
student.put('/attempts/:attemptId/answers', sameOrigin, async c => {
  const id = versionId.safeParse(c.req.param('attemptId'));
  if (!id.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  try {
    const userId = c.get('identity').id;
    const attempt = await c.env.EXAM_RESULTS.prepare(
      'SELECT id,save_version AS saveVersion,answer_snapshot_json AS answerSnapshotJson,grading_snapshot_json AS gradingSnapshotJson,expires_at AS expiresAt,status FROM attempts WHERE id=? AND user_id=?'
    ).bind(id.data,userId).first<{id:string;saveVersion:number;answerSnapshotJson:string;gradingSnapshotJson:string;expiresAt:number;status:string}>();
    if (!attempt) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
    const now = Math.floor(Date.now()/1000);
    if (attempt.status !== 'active' || attempt.expiresAt <= now)
      return c.json({ error: { code: 'ATTEMPT_CLOSED' } }, 409);
    const positions = new Set((JSON.parse(attempt.gradingSnapshotJson) as Array<{position:number}>).map(item=>String(item.position)));
    if (Object.keys(parsed.data.answers).some(key=>!positions.has(key)))
      return c.json({ error: { code: 'INVALID_ANSWER_POSITION' } }, 400);
    if (parsed.data.saveVersion !== attempt.saveVersion)
      return c.json({ error: { code: 'SAVE_CONFLICT', currentVersion: attempt.saveVersion } }, 409);
    const saved = await c.env.EXAM_RESULTS.prepare(
      "UPDATE attempts SET answer_snapshot_json=?,save_version=save_version+1,updated_at=? WHERE id=? AND user_id=? AND save_version=? AND status='active' AND expires_at>?"
    ).bind(JSON.stringify(parsed.data.answers),now,id.data,userId,parsed.data.saveVersion,now).run() as {meta?:{changes?:number}};
    if (saved.meta?.changes !== 1)
      return c.json({ error: { code: 'SAVE_CONFLICT' } }, 409);
    return c.json({ attemptId: id.data, saveVersion: parsed.data.saveVersion+1, savedAt: now });
  } catch {
    return c.json({ error: { code: 'WRITE_FAILED' } }, 503);
  }
});
student.get('/attempts/:attemptId/answers', async c => {
  const id = versionId.safeParse(c.req.param('attemptId'));
  if (!id.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  try {
    const attempt = await c.env.EXAM_RESULTS.prepare(
      'SELECT id,save_version AS saveVersion,answer_snapshot_json AS answerSnapshotJson,expires_at AS expiresAt,status FROM attempts WHERE id=? AND user_id=?'
    ).bind(id.data,c.get('identity').id).first<{id:string;saveVersion:number;answerSnapshotJson:string;expiresAt:number;status:string}>();
    if (!attempt) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
    return c.json({ attempt: { id: attempt.id, saveVersion: attempt.saveVersion, answers: JSON.parse(attempt.answerSnapshotJson), expiresAt: attempt.expiresAt, status: attempt.status } });
  } catch {
    return c.json({ error: { code: 'DB_UNAVAILABLE' } }, 503);
  }
});
export default student;
