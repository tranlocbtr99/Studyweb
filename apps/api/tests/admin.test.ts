import { describe, it, expect } from 'vitest';
import app from '../src/index';
import type { ReadDb, ReadQuery } from '../src/auth';

const token = 'a'.repeat(64);
async function fixture(role = 'admin', snapshotReady = false) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join('');
  const statements: Array<{ sql: string; args: unknown[] }> = [];
  const core: ReadDb = {
    prepare(sql: string): ReadQuery {
      const record = { sql, args: [] as unknown[] };
      return {
        bind(...args: unknown[]) { record.args = args; return this; },
        async first<T = unknown>() { return (snapshotReady && sql.includes('FROM exam_versions v JOIN exams') ? { id: record.args[0], subjectId: '123e4567-e89b-42d3-a456-426614174099' } : snapshotReady && sql.includes('FROM questions q JOIN question_drafts') ? { id: record.args[0], body: 'What is demand?', correctOption: 'B', explanation: 'Private explanation' } : sql.includes('FROM sessions') && record.args[0] === hash ? { id: 'admin-user' } : (sql.includes('FROM subjects WHERE id=') || sql.includes('FROM topics WHERE id=') || sql.includes('FROM exams WHERE id=')) ? { id: record.args[0] } : null) as T | null; },
        async all() { return { results: sql.includes('FROM user_roles') ? [{ code: role }] : snapshotReady && sql.includes('FROM question_options') ? ['A','B','C','D'].map(label => ({label,text:'Option '+label})) : [] }; },
        async run() { statements.push(record); return {}; }
      };
    },
    async batch(queries: ReadQuery[]) {
      for (const query of queries) await query.run();
      return [];
    }
  };
  return { env: { EXAM_CORE: core, EXAM_RESULTS: core }, statements };
}
function request(body: unknown, origin = 'http://localhost') {
  return { method: 'POST', headers: { Origin: origin, Cookie: 'studyweb_session=' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
describe('admin subjects', () => {
  it('requires authentication', async () => {
    const res = await app.request('/api/v1/admin/subjects', { method: 'POST', headers: { Origin: 'http://localhost' }, body: '{}' });
    expect(res.status).toBe(401);
  });
  it('denies non-admin users before writing', async () => {
    const { env, statements } = await fixture('student');
    const res = await app.request('/api/v1/admin/subjects', request({ slug: 'economics', title: 'Economics' }), env);
    expect(res.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
  it('denies cross-origin admin requests', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/subjects', request({ slug: 'economics', title: 'Economics' }, 'https://evil.example'), env);
    expect(res.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
  it('rejects invalid payload without writing', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/subjects', request({ slug: 'Invalid Slug', title: 'Economics' }), env);
    expect(res.status).toBe(400);
    expect(statements).toHaveLength(0);
  });
  it('creates a subject and its audit record together', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/subjects', request({ slug: 'economics', title: 'Economics' }), env);
    expect(res.status).toBe(201);
    const result = await res.json();
    expect(result.subject.slug).toBe('economics');
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain('INSERT INTO subjects');
    expect(statements[1].sql).toContain('INSERT INTO core_audit_logs');
    expect(statements[1].args[1]).toBe('admin-user');
    expect(statements[1].args[3]).toBe(result.subject.id);
  });
});

describe('admin topics', () => {
  it('requires authentication', async () => {
    const res = await app.request('/api/v1/admin/topics', { method:'POST', headers:{ Origin:'http://localhost' }, body:'{}' });
    expect(res.status).toBe(401);
  });
  it('rejects invalid subject identifiers', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/topics', request({subjectId:'bad',title:'Demand and supply'}), env);
    expect(res.status).toBe(400);
    expect(statements).toHaveLength(0);
  });
  it('creates a topic and audit record', async () => {
    const { env, statements } = await fixture();
    const subjectId='123e4567-e89b-42d3-a456-426614174000';
    const res = await app.request('/api/v1/admin/topics', request({subjectId,title:'Demand and supply'}), env);
    expect(res.status).toBe(201);
    const data=await res.json();
    expect(data.topic.subjectId).toBe(subjectId);
    expect(statements[0].sql).toContain('INSERT INTO topics');
    expect(statements[1].args[2]).toBe('topic.created');
    expect(statements[1].args[3]).toBe(data.topic.id);
  });
});

describe('admin question drafts', () => {
  const payload = {
    topicId: '123e4567-e89b-42d3-a456-426614174000',
    body: 'What does demand mean in economics?',
    options: ['Supply','Demand','Revenue','Profit'],
    correctOption: 'B',
    explanation: 'Demand is willingness and ability to purchase.'
  };
  it('rejects malformed option sets', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/questions', request({...payload,options:['A','B']}),env);
    expect(res.status).toBe(400);
    expect(statements).toHaveLength(0);
  });
  it('rejects non-admin writes', async () => {
    const { env, statements } = await fixture('student');
    const res = await app.request('/api/v1/admin/questions',request(payload),env);
    expect(res.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
  it('stores answer privately and excludes it from response', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/questions',request(payload),env);
    expect(res.status).toBe(201);
    const data=await res.json();
    expect(data.question.status).toBe('draft');
    expect(JSON.stringify(data)).not.toContain('correctOption');
    expect(JSON.stringify(data)).not.toContain(payload.explanation);
    expect(statements).toHaveLength(7);
    expect(statements[1].sql).toContain('INSERT INTO question_drafts');
    expect(statements[1].args[2]).toBe('B');
    expect(statements[6].args[2]).toBe('question.created');
  });
});

describe('admin exam drafts', () => {
  const payload = { subjectId: '123e4567-e89b-42d3-a456-426614174000', title: 'Microeconomics practice exam' };
  it('rejects non-admin users', async () => {
    const { env, statements } = await fixture('student');
    const res = await app.request('/api/v1/admin/exams', request(payload), env);
    expect(res.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
  it('rejects invalid subject ids', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/exams', request({...payload,subjectId:'invalid'}), env);
    expect(res.status).toBe(400);
    expect(statements).toHaveLength(0);
  });
  it('creates an exam and audit without publishing', async () => {
    const { env, statements } = await fixture();
    const res = await app.request('/api/v1/admin/exams', request(payload), env);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.exam.subjectId).toBe(payload.subjectId);
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain('INSERT INTO exams');
    expect(statements[1].args[2]).toBe('exam.created');
    expect(statements[1].args[3]).toBe(data.exam.id);
    expect(statements.every(s => !s.sql.includes('exam_versions'))).toBe(true);
  });
});

describe('admin exam versions', () => {
  const examId='123e4567-e89b-42d3-a456-426614174000';
  it('requires admin role', async () => {
    const { env, statements }=await fixture('student');
    const res=await app.request('/api/v1/admin/exam-versions',request({examId}),env);
    expect(res.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
  it('rejects invalid exam identifiers', async () => {
    const { env, statements }=await fixture();
    const res=await app.request('/api/v1/admin/exam-versions',request({examId:'invalid'}),env);
    expect(res.status).toBe(400);
    expect(statements).toHaveLength(0);
  });
  it('creates a draft version with atomic SQL numbering and audit', async () => {
    const { env, statements }=await fixture();
    const res=await app.request('/api/v1/admin/exam-versions',request({examId}),env);
    expect(res.status).toBe(201);
    const data=await res.json();
    expect(data.version.status).toBe('draft');
    expect(data.version.examId).toBe(examId);
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain('COALESCE(MAX(version_number),0)+1');
    expect(statements[0].args[1]).toBe(examId);
    expect(statements[1].args[2]).toBe('exam_version.created');
    expect(statements[1].args[3]).toBe(data.version.id);
  });
});

describe('admin exam item snapshots', () => {
  const payload={versionId:'123e4567-e89b-42d3-a456-426614174000',questionId:'123e4567-e89b-42d3-a456-426614174001',position:0};
  it('rejects invalid positions without writing', async () => {
    const {env,statements}=await fixture();
    const res=await app.request('/api/v1/admin/exam-items',request({...payload,position:-1}),env);
    expect(res.status).toBe(400);
    expect(statements).toHaveLength(0);
  });
  it('denies non-admin users', async () => {
    const {env,statements}=await fixture('student');
    const res=await app.request('/api/v1/admin/exam-items',request(payload),env);
    expect(res.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
  it('stores a public snapshot and private answer without leaking it', async () => {
    const {env,statements}=await fixture('admin',true);
    const res=await app.request('/api/v1/admin/exam-items',request(payload),env);
    expect(res.status).toBe(201);
    const data=await res.json();
    expect(data.item.question.options).toHaveLength(4);
    expect(JSON.stringify(data)).not.toContain('Private explanation');
    expect(JSON.stringify(data)).not.toContain('correctOption');
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain("status='draft'");
    expect(JSON.parse(statements[0].args[2] as string).options).toHaveLength(4);
    expect(JSON.parse(statements[0].args[3] as string).correctOption).toBe('B');
    expect(statements[1].args[2]).toBe('exam_item.created');
  });
  it('rejects unknown draft versions', async () => {
    const {env,statements}=await fixture();
    const res=await app.request('/api/v1/admin/exam-items',request(payload),env);
    expect(res.status).toBe(409);
    expect(statements).toHaveLength(0);
  });
});
