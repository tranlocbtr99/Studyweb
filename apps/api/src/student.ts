import { Hono } from 'hono';
import { z } from 'zod';
import { requireSession } from './auth';
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
export default student;
