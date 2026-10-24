import { Hono } from 'hono';
import { z } from 'zod';
type Env = { Bindings: { EXAM_CORE: D1Database; EXAM_RESULTS: D1Database } };
const app = new Hono<Env>();
const error = (code: string, message: string, requestId: string) => ({ error: { code, message, requestId } });
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.header('X-Request-ID', requestId);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Cache-Control', 'no-store');
  await next();
});
app.get('/api/v1/health', c => c.json({ status: 'ok', service: 'studyweb-api' }));
app.get('/api/v1/subjects', async c => {
  try {
    const rows = await c.env.EXAM_CORE.prepare('SELECT id, slug, title FROM subjects ORDER BY title LIMIT 100').all();
    return c.json({ subjects: rows.results });
  } catch {
    return c.json(error('DB_UNAVAILABLE', 'Database unavailable', c.res.headers.get('X-Request-ID') ?? ''), 503);
  }
});
const examId = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
app.get('/api/v1/exams/:id', async c => {
  const parsed = examId.safeParse(c.req.param('id'));
  if (!parsed.success) return c.json(error('BAD_ID', 'Invalid exam ID', c.res.headers.get('X-Request-ID') ?? ''), 400);
  try {
    const row = await c.env.EXAM_CORE.prepare('SELECT id, subject_id AS subjectId, title FROM exams WHERE id = ?').bind(parsed.data).first();
    if (!row) return c.json(error('NOT_FOUND', 'Exam not found', c.res.headers.get('X-Request-ID') ?? ''), 404);
    return c.json({ exam: row });
  } catch {
    return c.json(error('DB_UNAVAILABLE', 'Database unavailable', c.res.headers.get('X-Request-ID') ?? ''), 503);
  }
});
// Mutating exam routes deliberately unavailable until authentication, CSRF,
// cross-D1 grading snapshot verification and atomic submission are implemented.
// Never expose answer_key_private_json or grading_snapshot_json to clients.
app.notFound(c => c.json(error('NOT_FOUND', 'Route not found', c.res.headers.get('X-Request-ID') ?? ''), 404));
app.onError((_, c) => c.json(error('INTERNAL_ERROR', 'Internal server error', c.res.headers.get('X-Request-ID') ?? ''), 500));
export default app;
