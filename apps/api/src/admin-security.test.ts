import {describe,it,expect,vi} from 'vitest';
import admin from './admin';

const token='a'.repeat(64);
const id='11111111-1111-4111-8111-111111111111';
const payload={body:'Updated question body',options:['Alpha','Beta','Gamma','Delta'],correctOption:'B',explanation:'Because B'};
function mockDb(role='admin',status='draft'){
  const statements:string[]=[];
  const batch=vi.fn(async (_queries:unknown[])=>[]);
  const db={
    prepare:(sql:string)=>{
      statements.push(sql);
      return {
        bind(..._args:unknown[]){
          return this;
        },
        async first(){
          if(sql.includes('FROM sessions JOIN users'))return {id};
          if(sql.includes("FROM questions WHERE id=? AND status='draft'"))return status==='draft'?{id}:null;
          return null;
        },
        async all(){
          if(sql.includes('FROM user_roles JOIN roles'))return {results:[{code:role}]};
          return {results:[]};
        },
        async run(){return {};}
      };
    },
    batch
  };
  return {db,statements,batch};
}
function request(path:string,method='GET',body?:unknown,origin='https://example.test'){
  return new Request('https://example.test'+path,{
    method,headers:{Cookie:'studyweb_session='+token,Origin:origin,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
}
describe('admin question editing security',()=>{
  it('requires a session before listing private answers',async()=>{
    const {db}=mockDb();
    const response=await admin.fetch(new Request('https://example.test/questions'),{EXAM_CORE:db,EXAM_RESULTS:db});
    expect(response.status).toBe(401);
  });
  it('denies student access to private question listings',async()=>{
    const {db}=mockDb('student');
    const response=await admin.fetch(request('/questions'),{EXAM_CORE:db,EXAM_RESULTS:db});
    expect(response.status).toBe(403);
  });
  it('rejects cross-origin editing requests',async()=>{
    const {db,batch}=mockDb();
    const response=await admin.fetch(request('/questions/'+id,'PUT',payload,'https://attacker.test'),{EXAM_CORE:db,EXAM_RESULTS:db});
    expect(response.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });
  it('rejects editing non-draft questions',async()=>{
    const {db,batch}=mockDb('admin','active');
    const response=await admin.fetch(request('/questions/'+id,'PUT',payload),{EXAM_CORE:db,EXAM_RESULTS:db});
    expect(response.status).toBe(409);
    expect(batch).not.toHaveBeenCalled();
  });
  it('rejects invalid option counts',async()=>{
    const {db,batch}=mockDb();
    const response=await admin.fetch(request('/questions/'+id,'PUT',{...payload,options:['A','B']}),{EXAM_CORE:db,EXAM_RESULTS:db});
    expect(response.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });
  it('updates draft records but never rewrites exam item snapshots',async()=>{
    const {db,batch,statements}=mockDb();
    const response=await admin.fetch(request('/questions/'+id,'PUT',payload),{EXAM_CORE:db,EXAM_RESULTS:db});
    expect(response.status).toBe(200);
    expect(batch).toHaveBeenCalledOnce();
    expect(statements.filter(sql=>/UPDATE|INSERT/.test(sql)).every(sql=>!sql.includes('exam_items'))).toBe(true);
  });
});
