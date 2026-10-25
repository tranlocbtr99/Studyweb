import { useEffect, useRef, useState } from 'react';
import './style.css';
import AdminPanel from './AdminPanel';

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
  const [accessMode,setAccessMode]=useState<'student'|'admin'|'register'>('student');
  const [isAdmin,setIsAdmin]=useState(false);
  const [workspace,setWorkspace]=useState<'overview'|'authoring'|'exams'>('overview');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [signedIn,setSignedIn]=useState<boolean|null>(null);
  const [catalog,setCatalog]=useState<Array<{versionId:string;title:string;subject:string;questionCount:number}>>([]);
  const [versionId,setVersionId]=useState('');
  const [exam,setExam]=useState<Exam|null>(null);
  const [attempt,setAttempt]=useState<Attempt|null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [currentQuestion,setCurrentQuestion]=useState(0);
  const [result,setResult]=useState<Result|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [remaining,setRemaining]=useState(0);
  const [resumeAvailable,setResumeAvailable]=useState(false);
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
    if(signedIn!==true)return;
    setResumeAvailable(Boolean(sessionStorage.getItem('studyweb_active_attempt')));
  },[signedIn]);
  useEffect(()=>{
    const onBeforeUnload=(event:BeforeUnloadEvent)=>{
      if(attempt&&!result&&JSON.stringify(latestAnswers.current)!==savedAnswers.current){
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload',onBeforeUnload);
    return()=>window.removeEventListener('beforeunload',onBeforeUnload);
  },[attempt,result]);
  async function resume(){
    const raw=sessionStorage.getItem('studyweb_active_attempt');
    if(!raw)return;
    setBusy(true);setMessage('');
    try{
      const record=JSON.parse(raw) as {attemptId:string;versionId:string;expiresAt:number};
      if(!/^[0-9a-f-]{36}$/i.test(record.attemptId)||!/^[0-9a-f-]{36}$/i.test(record.versionId))throw new Error('Invalid saved attempt');
      const [examData,saveData]=await Promise.all([
        api<Exam>('/exam-versions/'+record.versionId),
        api<{attempt:{id:string;saveVersion:number;answers:Record<string,string>;expiresAt:number;status:string}}>('/attempts/'+record.attemptId+'/answers')
      ]);
      if(saveData.attempt.status!=='active')throw new Error('Lượt thi không còn hoạt động');
      const next={id:record.attemptId,expiresAt:saveData.attempt.expiresAt,saveVersion:saveData.attempt.saveVersion};
      setExam(examData);setCurrentQuestion(0);setVersionId(record.versionId);setAnswers(saveData.attempt.answers);
      savedAnswers.current=JSON.stringify(saveData.attempt.answers);
      latestAttempt.current=next;setAttempt(next);setResult(null);setSaveState('saved');
      setMessage('Đã khôi phục bài thi từ máy chủ');
    }catch(e){setMessage('Không thể tiếp tục bài thi: '+String(e));}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    let alive=true;
    fetch('/api/v1/me',{credentials:'same-origin'}).then(r=>{if(alive)setSignedIn(r.ok);if(r.ok)return fetch('/api/v1/admin/status',{credentials:'same-origin'}).then(admin=>{if(alive){setIsAdmin(admin.ok);if(admin.ok)setWorkspace('overview');}});}).catch(()=>{if(alive)setSignedIn(false);});
    return()=>{alive=false;};
  },[]);
  async function login(){
    setBusy(true);setMessage('');
    try{
      const res=await fetch('/api/v1/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      if(!res.ok)throw new Error('Đăng nhập thất bại ('+res.status+')');
      if(accessMode==='admin'){
        const status=await fetch('/api/v1/admin/status',{credentials:'same-origin'});
        if(!status.ok){await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin'});throw new Error('Tài khoản không có quyền quản trị');}
      }
      setIsAdmin(accessMode==='admin');setWorkspace(accessMode==='admin'?'authoring':'exams');setSignedIn(true);setPassword('');
    }catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  async function register(){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/v1/auth/register',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      if(!response.ok)throw new Error(response.status===409?'Email đã được sử dụng':response.status===429?'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau':'Đăng ký không thành công ('+response.status+')');
      setPassword('');setAccessMode('student');setMessage('Đăng ký thành công. Hãy đăng nhập bằng tài khoản vừa tạo.');
    }catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  async function logout(){
    setBusy(true);
    try{
      const res=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin'});
      if(!res.ok)throw new Error('Đăng xuất thất bại');
      sessionStorage.removeItem('studyweb_active_attempt');setResumeAvailable(false);setSignedIn(false);setIsAdmin(false);setExam(null);setAttempt(null);setAnswers({});savedAnswers.current='{}';setResult(null);
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
    try{const data=await api<{version:Exam['version'];questions:Exam['questions']}>('/exam-versions/'+encodeURIComponent(versionId));setExam(data);setCurrentQuestion(0);setAttempt(null);setAnswers({});setResult(null);}
    catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  async function start(){
    if(!exam)return;setBusy(true);setMessage('');
    try{
      const data=await api<{attempt:Attempt}>('/attempts',{method:'POST',body:JSON.stringify({versionId:exam.version.id})});
      sessionStorage.setItem('studyweb_active_attempt',JSON.stringify({attemptId:data.attempt.id,versionId:exam.version.id,expiresAt:data.attempt.expiresAt}));setResumeAvailable(true);setCurrentQuestion(0);setAttempt(data.attempt);latestAttempt.current=data.attempt;savedAnswers.current='{}';setAnswers({});setSaveState('idle');setResult(null);
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
      setResult(data.result);sessionStorage.removeItem('studyweb_active_attempt');setResumeAvailable(false);
    }catch(e){setMessage(String(e)+' — Bài chưa được xác nhận nộp. Kiểm tra trạng thái lưu và kết quả trước khi thử lại.');}finally{setBusy(false);}
  }
  return <main className="shell">
    <header><span className="brand">Studyweb</span><span className="subtle">Không gian ôn tập và thi trực tuyến</span></header>
    {signedIn===false&&<section className="panel"><h1>Chào mừng đến Studyweb</h1><p>Chọn cách truy cập phù hợp với bạn.</p>
      <nav className="access-modes" aria-label="Lựa chọn truy cập">
        <button type="button" className={accessMode==='student'?'':'secondary'} aria-pressed={accessMode==='student'} onClick={()=>{setAccessMode('student');setMessage('');}}>Đăng nhập học viên</button>
        <button type="button" className={accessMode==='admin'?'':'secondary'} aria-pressed={accessMode==='admin'} onClick={()=>{setAccessMode('admin');setMessage('');}}>Đăng nhập quản trị</button>
        <button type="button" className={accessMode==='register'?'':'secondary'} aria-pressed={accessMode==='register'} onClick={()=>{setAccessMode('register');setMessage('');}}>Đăng ký tài khoản</button>
      </nav>
      {accessMode==='register'?<div className="access-info"><h2>Đăng ký tài khoản học viên</h2><p>Tạo tài khoản miễn phí để tham gia ôn tập và thi trực tuyến.</p><form className="login" onSubmit={e=>{e.preventDefault();void register();}}><label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Mật khẩu (tối thiểu 12 ký tự)<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit" disabled={busy}>Tạo tài khoản học viên</button></form></div>:
      <><h2>{accessMode==='admin'?'Đăng nhập quản trị':'Đăng nhập học viên'}</h2>
      <form className="login" onSubmit={e=>{e.preventDefault();void login();}}>
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Mật khẩu<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button disabled={busy} type="submit">Đăng nhập</button>
      </form></>}
    </section>}
    {signedIn&&<div className="toolbar account"><span>Đã đăng nhập</span><button className="secondary" disabled={busy} onClick={logout}>Đăng xuất</button></div>}
    {signedIn&&isAdmin&&<section className="panel admin-home">
      <div className="admin-home-heading"><div><span className="admin-eyebrow">LTStudy · Quản trị</span><h1>Không gian quản trị</h1><p>Quản lý nội dung học tập và tổ chức thi trực tuyến.</p></div><span className="admin-live">Hệ thống trực tuyến</span></div>
      <nav className="admin-navigation" aria-label="Điều hướng quản trị">
        <button className={workspace==='overview'?'':'secondary'} onClick={()=>setWorkspace('overview')}>Tổng quan</button>
        <button className={workspace==='authoring'?'':'secondary'} onClick={()=>setWorkspace('authoring')}>Tạo đề thi</button>
        <button className={workspace==='exams'?'':'secondary'} onClick={()=>setWorkspace('exams')}>Phòng thi</button>
      </nav>
      {workspace==='overview'&&<div className="admin-overview-grid">
        <article><span className="admin-stat-icon">📚</span><h2>Khóa học và môn học</h2><p>Phân chia môn học và chủ đề để xây dựng ngân hàng câu hỏi.</p><button onClick={()=>setWorkspace('authoring')}>Quản lý nội dung</button></article>
        <article><span className="admin-stat-icon">📝</span><h2>Ngân hàng câu hỏi</h2><p>Soạn câu hỏi trắc nghiệm, đáp án đúng và phần giải thích.</p><button onClick={()=>setWorkspace('authoring')}>Biên soạn câu hỏi</button></article>
        <article><span className="admin-stat-icon">🎓</span><h2>Đề thi trực tuyến</h2><p>Tạo phiên bản nháp, ghép câu hỏi và xuất bản đề thi.</p><button onClick={()=>setWorkspace('authoring')}>Tạo đề mới</button></article>
      </div>}
    </section>}
    {signedIn&&isAdmin&&workspace==='authoring'&&<AdminPanel/>}
    {signedIn&&(!isAdmin||workspace==='exams')&&resumeAvailable&&!attempt&&<section className="panel"><h2>Bài thi đang làm</h2><p>Khôi phục câu trả lời đã lưu trên máy chủ sau khi tải lại trang.</p><button disabled={busy} onClick={resume}>Tiếp tục bài thi</button></section>}
    {signedIn&&(!isAdmin||workspace==='exams')&&<section className="panel"><h1>Phòng thi trực tuyến</h1><p>Nhập mã phiên bản đề thi đã xuất bản. Bạn có thể tải đề thi bằng mã phiên bản đã xuất bản.</p>
      <div className="toolbar"><button disabled={busy} onClick={showCatalog}>Xem danh sách đề thi</button></div>
      {catalog.map(item=><button key={item.versionId} className="secondary" disabled={busy} onClick={()=>setVersionId(item.versionId)}>{item.subject} — {item.title} ({item.questionCount} câu)</button>)}
      <div className="toolbar"><input aria-label="Mã phiên bản đề thi" placeholder="Mã phiên bản đề thi (UUID)" value={versionId} onChange={e=>setVersionId(e.target.value)}/><button disabled={busy||!versionId} onClick={loadExam}>Tải đề thi</button></div>
    </section>}
    {signedIn&&(!isAdmin||workspace==='exams')&&exam&&<section className="panel"><div className="toolbar"><h2>Đề thi · {exam.questions.length} câu</h2>{!attempt&&<button disabled={busy} onClick={start}>Bắt đầu làm bài</button>}</div>
      {attempt&&<div className="status"><span>Thời gian còn lại: <strong>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong></span><span>Phiên bản lưu: {attempt.saveVersion} · {({idle:'Chưa thay đổi',pending:'Chờ lưu',saving:'Đang lưu',saved:'Đã lưu',error:'Lưu thất bại'} as const)[saveState]}</span></div>}
      <div className="exam-progress" aria-live="polite"><strong>Đã trả lời {exam.questions.filter(({position})=>Boolean(answers[String(position)])).length}/{exam.questions.length} câu</strong><span>Đang xem câu {Math.min(currentQuestion+1,exam.questions.length)}/{exam.questions.length}</span></div>
      <nav className="question-navigation" aria-label="Chọn câu hỏi">
        {exam.questions.map(({position},index)=><button key={position} type="button" aria-current={index===currentQuestion?'step':undefined} aria-label={'Câu '+(position+1)+(answers[String(position)]?' đã trả lời':' chưa trả lời')} className={index===currentQuestion?'question-current':answers[String(position)]?'question-answered':'secondary'} onClick={()=>setCurrentQuestion(index)}>{position+1}</button>)}
      </nav>
      {exam.questions.filter((_,index)=>index===currentQuestion).map(({position,question})=><article className="question" key={position}><h3>Câu {position+1}. {question.body}</h3>
        {question.options.map(option=><label className="option" key={option.label}><input type="radio" name={'q'+position} disabled={!attempt||!!result||remaining===0} checked={answers[String(position)]===option.label} onChange={()=>setAnswers(prev=>({...prev,[String(position)]:option.label}))}/><span>{option.label}. {option.text}</span></label>)}</article>)}
      <div className="toolbar question-controls"><button className="secondary" disabled={currentQuestion===0} onClick={()=>setCurrentQuestion(index=>Math.max(0,index-1))}>Câu trước</button><button className="secondary" disabled={currentQuestion>=exam.questions.length-1} onClick={()=>setCurrentQuestion(index=>Math.min(exam.questions.length-1,index+1))}>Câu tiếp</button></div>
      {attempt&&!result&&<div className="toolbar"><button className="secondary" disabled={busy} onClick={recover}>Khôi phục đáp án</button><button disabled={busy||remaining===0} onClick={save}>Lưu bài</button><button className="danger" disabled={busy||remaining===0} onClick={submit}>Nộp bài</button></div>}
    </section>}
    {signedIn&&(!isAdmin||workspace==='exams')&&result&&<section className="panel"><h2>Kết quả bài thi</h2><p className="score">{result.points} / {result.maxPoints}</p><p>Đã nộp: {new Date(result.submittedAt*1000).toLocaleString('vi-VN')}</p></section>}
    {message&&<p role="alert" className="notice">{message}</p>}
  </main>;
}
