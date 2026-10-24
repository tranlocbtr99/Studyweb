import { Hono } from 'hono';
import { z } from 'zod';
// Minimal structural typing keeps this read-only scaffold independent of
// Cloudflare type-package publication dates; replace with generated Env types.
type ReadQuery = { bind(...args: unknown[]): ReadQuery; all(): Promise<{ results: unknown[] }>; first(): Promise<unknown> };
type ReadDb = { prepare(query: string): ReadQuery };
type Env = { Bindings: { EXAM_CORE: ReadDb; EXAM_RESULTS: ReadDb } };
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
// Mutation endpoints are disabled pending authentication and atomic grading.
app.notFound(c => c.json(error('NOT_FOUND', 'Route not found', c.res.headers.get('X-Request-ID') ?? ''), 404));
app.onError((_, c) => c.json(error('INTERNAL_ERROR', 'Internal server error', c.res.headers.get('X-Request-ID') ?? ''), 500));
export default app;
