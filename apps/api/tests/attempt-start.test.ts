import { describe, expect, it } from 'vitest';
import app from '../src/index';
import type { ReadDb, ReadQuery } from '../src/auth';
import { examContentHash } from '../src/exam-integrity';

const token='a'.repeat(64);
const versionId='123e4567-e89b-42d3-a456-426614174000';
const item={position:0,questionSnapshotJson:JSON.stringify({body:'What is demand?',options:['A','B','C','D'].map(label=>({label,text:'Option '+label}))}),answerKeyPrivateJson:JSON.stringify({correctOption:'B',explanation:'Secret'})};
async function fixture(published=true, validDigest=true) {
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
  const writes:Array<{sql:string;args:unknown[]}>=[];
  const digest=await examContentHash([item]);
  const core:ReadDb={
    prepare(sql:string):ReadQuery {
      let args:unknown[]=[];
      return {
        bind(...values:unknown[]){args=values;return this;},
        async first<T=unknown>(){
          if(sql.includes('FROM sessions'))return (args[0]===hash?{id:'student-user'}:null) as T|null;
          if(sql.includes('FROM exam_versions'))return (published?{id:versionId,contentHash:validDigest?digest:'bad-digest',itemsRevision:1}:null) as T|null;
          return null;
        },
        async all(){
          if(sql.includes('FROM user_roles'))return {results:[{code:'student'}]};
          if(sql.includes('FROM exam_items'))return {results:[item]};
          return {results:[]};
        },
        async run(){return {};}
      };
    },
    async batch(){return [];}
  };
  const results:ReadDb={
    prepare(sql:string):ReadQuery {
      const record={sql,args:[] as unknown[]};
      return {
        bind(...args:unknown[]){record.args=args;return this;},
        async first<T=unknown>(){return null as T|null;},
        async all(){return {results:[]};},
        async run(){writes.push(record);return {};}
      };
    },
    async batch(queries:ReadQuery[]){for(const query of queries)await query.run();return [];}
  };
  return {env:{EXAM_CORE:core,EXAM_RESULTS:results},writes};
}
function startRequest(body:unknown,origin='http://localhost') {
  return {method:'POST',headers:{Origin:origin,Cookie:'studyweb_session='+token,'Content-Type':'application/json'},body:JSON.stringify(body)};
}
describe('student attempt creation',()=>{
  it('rejects drafts without writing',async()=>{
    const {env,writes}=await fixture(false);
    const res=await app.request('/api/v1/student/attempts',startRequest({versionId}),env);
    expect(res.status).toBe(404);
    expect(writes).toHaveLength(0);
  });
  it('rejects modified content digest without writing',async()=>{
    const {env,writes}=await fixture(true,false);
    const res=await app.request('/api/v1/student/attempts',startRequest({versionId}),env);
    expect(res.status).toBe(409);
    expect(writes).toHaveLength(0);
  });
  it('rejects cross-origin creation',async()=>{
    const {env,writes}=await fixture();
    const res=await app.request('/api/v1/student/attempts',startRequest({versionId},'https://evil.example'),env);
    expect(res.status).toBe(403);
    expect(writes).toHaveLength(0);
  });
  it('stores grading privately and returns only timing metadata',async()=>{
    const {env,writes}=await fixture();
    const res=await app.request('/api/v1/student/attempts',startRequest({versionId}),env);
    expect(res.status).toBe(201);
    const data=await res.json();
    expect(data.attempt.expiresAt-data.attempt.startedAt).toBe(5400);
    expect(data.attempt.saveVersion).toBe(0);
    expect(JSON.stringify(data)).not.toContain('correctOption');
    expect(JSON.stringify(data)).not.toContain('Secret');
    expect(writes).toHaveLength(2);
    expect(writes[0].sql).toContain('INSERT INTO attempts');
    expect(JSON.parse(writes[0].args[4] as string)[0].correctOption).toBe('B');
    expect(writes[1].args[2]).toBe('attempt.started');
  });
});
