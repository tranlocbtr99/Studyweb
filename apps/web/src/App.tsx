import { useEffect, useRef, useState } from 'react';
import './style.css';

type Question = { body:string; options:Array<{label:string;text:string}> };
type Exam = { version:{id:string;examId:string};questions:Array<{position:number;question:Question}> };
type Attempt = { id:string;expiresAt:number;saveVersion:number };
type Result = { points:number;maxPoints:number;submittedAt:number };
const api = async <T,>(path:string,init?:RequestInit):Promise<T> => {
  const res=await fetch('/api/v1/student'+path,{credentials:'same-origin',...init,headers:{'Content-Type':'application/json',...init?.headers}});
  const body=await res.json() as T & {error?:{code:string}};
  if(!res.ok)throw new Error(body.error?.code??'REQUEST_FAILED');
  return body;
};
export default function App(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [signedIn,setSignedIn]=useState<boolean|null>(null);
  const [catalog,setCatalog]=useState<Array<{versionId:string;title:string;subject:string;questionCount:number}>>([]);
  const [versionId,setVersionId]=useState('');
  const [exam,setExam]=useState<Exam|null>(null);
  const [attempt,setAttempt]=useState<Attempt|null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [result,setResult]=useState<Result|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [remaining,setRemaining]=useState(0);
  const [saveState,setSaveState]=useState<'idle'|'pending'|'saving'|'saved'|'error'>('idle');
  const savedAnswers=useRef('{}');
  const latestAnswers=useRef(answers);
  const latestAttempt=useRef(attempt);
  const saveQueue=useRef<Promise<void>>(Promise.resolve());
  latestAnswers.current=answers;
  latestAttempt.current=attempt;
  function queueSave():Promise<void>{
    const job=saveQueue.current.catch(()=>undefined).then(async()=>{
      const current=latestAttempt.current;
      if(!current||result)return;
      const snapshot=JSON.stringify(latestAnswers.current);
      if(snapshot===savedAnswers.current){setSaveState('saved');return;}
      setSaveState('saving');
      try{
        const data=await api<{saveVersion:number}>('/attempts/'+current.id+'/answers',{
          method:'PUT',body:JSON.stringify({saveVersion:current.saveVersion,answers:JSON.parse(snapshot)})
        });
        savedAnswers.current=snapshot;
        latestAttempt.current={...current,saveVersion:data.saveVersion};
        setAttempt(previous=>previous?.id===current.id?{...previous,saveVersion:data.saveVersion}:previous);
        setSaveState(snapshot===JSON.stringify(latestAnswers.current)?'saved':'pending');
      }catch(e){setSaveState('error');throw e;}
    });
    saveQueue.current=job;
    return job;
  }
  useEffect(()=>{
    if(!attempt||result||remaining<=0)return;
    if(JSON.stringify(answers)===savedAnswers.current)return;
    setSaveState('pending');
    const timer=window.setTimeout(()=>{void queueSave().catch(()=>setMessage('Không thể tự động lưu. Kiểm tra kết nối và thử lưu lại.'));},1500);
    return()=>window.clearTimeout(timer);
  },[answers,attempt?.id,result,remaining>0]);

  useEffect(()=>{
    let alive=true;
    fetch('/api/v1/me',{credentials:'same-origin'}).then(r=>{if(alive)setSignedIn(r.ok);}).catch(()=>{if(alive)setSignedIn(false);});
    return()=>{alive=false;};
  },[]);
  async function login(){
    setBusy(true);setMessage('');
    try{
      const res=await fetch('/api/v1/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      if(!res.ok)throw new Error('Đăng nhập thất bại ('+res.status+')');
      setSignedIn(true);setPassword('');
    }catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  async function logout(){
    setBusy(true);
    try{
      const res=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin'});
      if(!res.ok)throw new Error('Đăng xuất thất bại');
      setSignedIn(false);setExam(null);setAttempt(null);setAnswers({});savedAnswers.current='{}';setResult(null);
    }catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  useEffect(()=>{
    if(!attempt)return;
    const tick=()=>setRemaining(Math.max(0,attempt.expiresAt-Math.floor(Date.now()/1000)));
    tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);
  },[attempt]);
  async function showCatalog(){
    setBusy(true);setMessage('');
    try{
      const data=await api<{exams:Array<{versionId:string;title:string;subject:string;questionCount:number}>}>('/exam-catalog');
      setCatalog(data.exams);
    }catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  async function loadExam(){
    setBusy(true);setMessage('');
    try{const data=await api<{version:Exam['version'];questions:Exam['questions']}>('/exam-versions/'+encodeURIComponent(versionId));setExam(data);setAttempt(null);setAnswers({});setResult(null);}
    catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  async function start(){
    if(!exam)return;setBusy(true);setMessage('');
    try{
      const data=await api<{attempt:Attempt}>('/attempts',{method:'POST',body:JSON.stringify({versionId:exam.version.id})});
      setAttempt(data.attempt);latestAttempt.current=data.attempt;savedAnswers.current='{}';setAnswers({});setSaveState('idle');setResult(null);
    }catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  async function recover(){
    if(!attempt)return;setBusy(true);
    try{const data=await api<{attempt:{saveVersion:number;answers:Record<string,string>}}>('/attempts/'+attempt.id+'/answers');
      setAnswers(data.attempt.answers);savedAnswers.current=JSON.stringify(data.attempt.answers);latestAttempt.current={...attempt,saveVersion:data.attempt.saveVersion};setAttempt({...attempt,saveVersion:data.attempt.saveVersion});setSaveState('saved');setMessage('Đã khôi phục đáp án đã lưu');
    }catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  async function save(){
    try{await queueSave();setMessage('Đã lưu đáp án');}
    catch(e){setMessage(String(e)+' — Dữ liệu chưa được lưu; không nộp bài cho đến khi lưu thành công.');}
  }
  async function submit(){
    if(!attempt||!window.confirm('Xác nhận nộp bài?'))return;
    setBusy(true);setMessage('');
    const key=window.crypto.randomUUID();
    try{
      await queueSave();
      const current=latestAttempt.current;
      if(!current)throw new Error('Không tìm thấy lượt thi');
      const data=await api<{result:Result}>('/attempts/'+current.id+'/submit',{method:'POST',body:JSON.stringify({saveVersion:current.saveVersion,idempotencyKey:key})});
      setResult(data.result);
    }catch(e){setMessage(String(e)+' — Bài chưa được xác nhận nộp. Kiểm tra trạng thái lưu và kết quả trước khi thử lại.');}finally{setBusy(false);}
  }
  return <main className="shell">
    <header><span className="brand">Studyweb</span><span className="subtle">Không gian ôn tập và thi trực tuyến</span></header>
    {signedIn===false&&<section className="panel"><h1>Đăng nhập học viên</h1><p>Sử dụng tài khoản đã được quản trị viên cấp.</p>
      <form className="login" onSubmit={e=>{e.preventDefault();void login();}}>
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Mật khẩu<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button disabled={busy} type="submit">Đăng nhập</button>
      </form>
    </section>}
    {signedIn&&<div className="toolbar account"><span>Đã đăng nhập</span><button className="secondary" disabled={busy} onClick={logout}>Đăng xuất</button></div>}
    {signedIn&&<section className="panel"><h1>Phòng thi trực tuyến</h1><p>Nhập mã phiên bản đề thi đã xuất bản. Bạn có thể tải đề thi bằng mã phiên bản đã xuất bản.</p>
      <div className="toolbar"><button disabled={busy} onClick={showCatalog}>Xem danh sách đề thi</button></div>
      {catalog.map(item=><button key={item.versionId} className="secondary" disabled={busy} onClick={()=>setVersionId(item.versionId)}>{item.subject} — {item.title} ({item.questionCount} câu)</button>)}
      <div className="toolbar"><input aria-label="Mã phiên bản đề thi" placeholder="Mã phiên bản đề thi (UUID)" value={versionId} onChange={e=>setVersionId(e.target.value)}/><button disabled={busy||!versionId} onClick={loadExam}>Tải đề thi</button></div>
    </section>}
    {signedIn&&exam&&<section className="panel"><div className="toolbar"><h2>Đề thi · {exam.questions.length} câu</h2>{!attempt&&<button disabled={busy} onClick={start}>Bắt đầu làm bài</button>}</div>
      {attempt&&<div className="status"><span>Thời gian còn lại: <strong>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong></span><span>Phiên bản lưu: {attempt.saveVersion} · {({idle:'Chưa thay đổi',pending:'Chờ lưu',saving:'Đang lưu',saved:'Đã lưu',error:'Lưu thất bại'} as const)[saveState]}</span></div>}
      {exam.questions.map(({position,question})=><article className="question" key={position}><h3>Câu {position+1}. {question.body}</h3>
        {question.options.map(option=><label className="option" key={option.label}><input type="radio" name={'q'+position} disabled={!attempt||!!result||remaining===0} checked={answers[String(position)]===option.label} onChange={()=>setAnswers(prev=>({...prev,[String(position)]:option.label}))}/><span>{option.label}. {option.text}</span></label>)}</article>)}
      {attempt&&!result&&<div className="toolbar"><button className="secondary" disabled={busy} onClick={recover}>Khôi phục đáp án</button><button disabled={busy||remaining===0} onClick={save}>Lưu bài</button><button className="danger" disabled={busy||remaining===0} onClick={submit}>Nộp bài</button></div>}
    </section>}
    {signedIn&&result&&<section className="panel"><h2>Kết quả bài thi</h2><p className="score">{result.points} / {result.maxPoints}</p><p>Đã nộp: {new Date(result.submittedAt*1000).toLocaleString('vi-VN')}</p></section>}
    {message&&<p role="alert" className="notice">{message}</p>}
  </main>;
}
