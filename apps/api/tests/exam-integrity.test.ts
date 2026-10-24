import { describe, expect, it } from 'vitest';
import { examContentHash } from '../src/exam-integrity';
const q = {questionId:'q1',body:'What is demand?',options:['A','B','C','D'].map(label=>({label,text:'Option '+label}))};
const key = {correctOption:'B',explanation:'Private explanation'};
const item = (position=0, question=q, answer=key) => ({
  position,questionSnapshotJson:JSON.stringify(question),answerKeyPrivateJson:JSON.stringify(answer)
});
describe('exam content integrity', () => {
  it('produces stable SHA-256 regardless of JSON object key order',async () => {
    const a=await examContentHash([item()]);
    const b=await examContentHash([item(0,{options:q.options,body:q.body,questionId:q.questionId},{explanation:key.explanation,correctOption:'B'})]);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(b);
  });
  it('changes when the answer or question changes',async () => {
    const baseline=await examContentHash([item()]);
    expect(await examContentHash([item(0,q,{...key,correctOption:'C'})])).not.toBe(baseline);
    expect(await examContentHash([item(0,{...q,body:'What is supply?'})])).not.toBe(baseline);
  });
  it('rejects empty and gapped versions',async () => {
    await expect(examContentHash([])).rejects.toThrow('INVALID_ITEM_COUNT');
    await expect(examContentHash([item(1)])).rejects.toThrow('NON_CONTIGUOUS_POSITIONS');
  });
  it('rejects leaked answers in public snapshots and malformed options',async () => {
    await expect(examContentHash([item(0,{...q,correctOption:'B'} as typeof q)])).rejects.toThrow('INVALID_ITEM_SNAPSHOT');
    await expect(examContentHash([item(0,{...q,options:q.options.slice(0,3)})])).rejects.toThrow('INVALID_ITEM_SNAPSHOT');
  });
});
