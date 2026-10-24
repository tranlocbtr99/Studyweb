import { describe, expect, it } from 'vitest';
import app from '../src/index';
import type { ReadDb, ReadQuery } from '../src/auth';

const token = 'a'.repeat(64);
const id = '123e4567-e89b-42d3-a456-426614174000';
async function fixture(published=true) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))), b=>b.toString(16).padStart(2,'0')).join('');
  const queries:string[]=[];
  const db:ReadDb = {
    prepare(sql:string):ReadQuery {
      queries.push(sql);
      let args:unknown[]=[];
      return {
        bind(...values:unknown[]){args=values;return this;},
        async first<T=unknown>(){
          if(sql.includes('FROM sessions'))return (args[0]===hash?{id:'student-user'}:null) as T|null;
          if(sql.includes('FROM exam_versions'))return (published?{id,examId:'exam',versionNumber:1,contentHash:'digest'}:null) as T|null;
          return null;
        },
        async all(){
          if(sql.includes('FROM user_roles'))return {results:[{code:'student'}]};
          if(sql.includes('FROM exam_items'))return {results:[{position:0,snapshot:JSON.stringify({body:'Question',options:['A','B','C','D']})}]};
          return {results:[]};
        },
        async run(){return {};}
      };
    },
    async batch(){return [];}
  };
  return {env:{EXAM_CORE:db,EXAM_RESULTS:db},queries};
}
describe('student published exam read model',()=>{
  it('requires a session',async()=>{
    const res=await app.request('/api/v1/student/exam-versions/'+id);
    expect(res.status).toBe(401);
  });
  it('rejects malformed identifiers',async()=>{
    const {env}=await fixture();
    const res=await app.request('/api/v1/student/exam-versions/not-an-id',{headers:{Cookie:'studyweb_session='+token}},env);
    expect(res.status).toBe(400);
  });
  it('hides draft exam versions',async()=>{
    const {env,queries}=await fixture(false);
    const res=await app.request('/api/v1/student/exam-versions/'+id,{headers:{Cookie:'studyweb_session='+token}},env);
    expect(res.status).toBe(404);
    expect(queries.some(q=>q.includes('FROM exam_items'))).toBe(false);
  });
  it('serves only public snapshots to authenticated students',async()=>{
    const {env,queries}=await fixture();
    const res=await app.request('/api/v1/student/exam-versions/'+id,{headers:{Cookie:'studyweb_session='+token}},env);
    expect(res.status).toBe(200);
    const body=await res.json();
    expect(body.questions[0].question.body).toBe('Question');
    expect(queries.every(q=>!q.includes('answer_key_private_json'))).toBe(true);
    expect(JSON.stringify(body)).not.toContain('correctOption');
  });
});
