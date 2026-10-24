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

const submitSchema = z.object({
  idempotencyKey: z.string().uuid(),
  saveVersion: z.number().int().min(0)
}).strict();
student.post('/attempts/:attemptId/submit', sameOrigin, async c => {
  const id = versionId.safeParse(c.req.param('attemptId'));
  if (!id.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return c.json({ error: { code: 'BAD_JSON' } }, 400); }
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  const { idempotencyKey, saveVersion } = parsed.data;
  const db = c.env.EXAM_RESULTS;
  const userId = c.get('identity').id;
  try {
    const receipt = await db.prepare(
      'SELECT r.idempotency_key AS idempotencyKey,r.response_json AS responseJson FROM submission_receipts r JOIN attempts a ON a.id=r.attempt_id WHERE r.attempt_id=? AND a.user_id=?'
    ).bind(id.data,userId).first<{idempotencyKey:string;responseJson:string}>();
    if (receipt) {
      if (receipt.idempotencyKey !== idempotencyKey)
        return c.json({ error: { code: 'ALREADY_SUBMITTED' } }, 409);
      return c.json(JSON.parse(receipt.responseJson) as object);
    }
    const attempt = await db.prepare(
      'SELECT id,save_version AS saveVersion,grading_snapshot_json AS gradingSnapshotJson,answer_snapshot_json AS answerSnapshotJson,expires_at AS expiresAt,status FROM attempts WHERE id=? AND user_id=?'
    ).bind(id.data,userId).first<{id:string;saveVersion:number;gradingSnapshotJson:string;answerSnapshotJson:string;expiresAt:number;status:string}>();
    if (!attempt) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
    const now = Math.floor(Date.now()/1000);
    if (attempt.status !== 'active' || attempt.expiresAt <= now)
      return c.json({ error: { code: 'ATTEMPT_CLOSED' } }, 409);
    if (attempt.saveVersion !== saveVersion)
      return c.json({ error: { code: 'SAVE_CONFLICT', currentVersion: attempt.saveVersion } }, 409);
    const grading = JSON.parse(attempt.gradingSnapshotJson) as Array<{position:number;correctOption:string}>;
    const answers = JSON.parse(attempt.answerSnapshotJson) as Record<string,string>;
    const points = grading.reduce((sum,item)=>sum+(answers[String(item.position)]===item.correctOption?1:0),0);
    const response = { result: { attemptId: id.data, points, maxPoints: grading.length, submittedAt: now } };
    const writes = await db.batch([
      db.prepare(
        "UPDATE attempts SET status='submitted',submitted_at=?,updated_at=? WHERE id=? AND user_id=? AND status='active' AND expires_at>? AND save_version=?"
      ).bind(now,now,id.data,userId,now,saveVersion),
      db.prepare(
        "INSERT INTO scores(id,attempt_id,points,max_points,graded_at,grading_version) SELECT ?,id,?,?,?,'v1' FROM attempts WHERE id=? AND user_id=? AND status='submitted' AND submitted_at=?"
      ).bind(crypto.randomUUID(),points,grading.length,now,id.data,userId,now),
      db.prepare(
        "INSERT INTO submission_receipts(id,attempt_id,idempotency_key,response_json,created_at) SELECT ?,id,?,?,? FROM attempts WHERE id=? AND user_id=? AND status='submitted' AND submitted_at=?"
      ).bind(crypto.randomUUID(),idempotencyKey,JSON.stringify(response),now,id.data,userId,now)
    ]);
    if ((writes as Array<{meta?:{changes?:number}}>)[0]?.meta?.changes !== 1)
      return c.json({ error: { code: 'SUBMISSION_CONFLICT' } }, 409);
    return c.json(response);
  } catch {
    // A concurrent request may have committed first; allow exact-key replay.
    try {
      const receipt = await db.prepare(
        'SELECT r.idempotency_key AS idempotencyKey,r.response_json AS responseJson FROM submission_receipts r JOIN attempts a ON a.id=r.attempt_id WHERE r.attempt_id=? AND a.user_id=?'
      ).bind(id.data,userId).first<{idempotencyKey:string;responseJson:string}>();
      if (receipt?.idempotencyKey === idempotencyKey) return c.json(JSON.parse(receipt.responseJson) as object);
      if (receipt) return c.json({ error: { code: 'ALREADY_SUBMITTED' } }, 409);
    } catch { /* Keep the original failure response. */ }
    return c.json({ error: { code: 'SUBMISSION_UNAVAILABLE' } }, 503);
  }
});

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0)
});
student.get('/attempts', async c => {
  const parsed = historyQuery.safeParse({limit:c.req.query('limit'),offset:c.req.query('offset')});
  // Undefined query values should receive defaults, not NaN.
  const limit = c.req.query('limit') === undefined ? 20 : parsed.success ? parsed.data.limit : null;
  const offset = c.req.query('offset') === undefined ? 0 : parsed.success ? parsed.data.offset : null;
  if (limit === null || offset === null) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  try {
    const rows = await c.env.EXAM_RESULTS.prepare(
      'SELECT a.id,a.exam_version_id AS versionId,a.started_at AS startedAt,a.expires_at AS expiresAt,a.status,a.submitted_at AS submittedAt,s.points,s.max_points AS maxPoints FROM attempts a LEFT JOIN scores s ON s.attempt_id=a.id WHERE a.user_id=? ORDER BY a.started_at DESC,a.id DESC LIMIT ? OFFSET ?'
    ).bind(c.get('identity').id,limit,offset).all();
    return c.json({ attempts: rows.results, pagination: {limit,offset} });
  } catch {
    return c.json({ error: { code: 'DB_UNAVAILABLE' } }, 503);
  }
});
student.get('/attempts/:attemptId/result', async c => {
  const id = versionId.safeParse(c.req.param('attemptId'));
  if (!id.success) return c.json({ error: { code: 'VALIDATION_FAILED' } }, 400);
  try {
    const row = await c.env.EXAM_RESULTS.prepare(
      'SELECT a.id AS attemptId,a.exam_version_id AS versionId,a.status,a.started_at AS startedAt,a.submitted_at AS submittedAt,s.points,s.max_points AS maxPoints,s.graded_at AS gradedAt FROM attempts a LEFT JOIN scores s ON s.attempt_id=a.id WHERE a.id=? AND a.user_id=?'
    ).bind(id.data,c.get('identity').id).first<{attemptId:string;status:string;points:number|null;maxPoints:number|null}>();
    if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
    if (row.status !== 'submitted' || row.points === null || row.maxPoints === null)
      return c.json({ error: { code: 'RESULT_NOT_READY' } }, 409);
    return c.json({ result: row });
  } catch {
    return c.json({ error: { code: 'DB_UNAVAILABLE' } }, 503);
  }
});
export default student;
