import { useEffect, useRef, useState } from 'react';
import './style.css';
import AdminPanel from './AdminPanel';
import ReviewFlags from './ReviewFlags';
import UserDirectory from './UserDirectory';

type Question = { body:string; options:Array<{label:string;text:string}> };
type Exam = { version:{id:string;examId:string;durationMinutes:number};questions:Array<{position:number;question:Question}> };
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
  const [workspace,setWorkspace]=useState<'overview'|'authoring'|'exams'|'users'>('overview');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [signedIn,setSignedIn]=useState<boolean|null>(null);
  const [history,setHistory]=useState<Array<{id:string;versionId:string;startedAt:number;status:string;submittedAt:number|null;points:number|null;maxPoints:number|null}>>([]);
  const [historyOffset,setHistoryOffset]=useState(0);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [catalog,setCatalog]=useState<Array<{versionId:string;title:string;subject:string;questionCount:number;durationMinutes:number}>>([]);
  const [catalogSearch,setCatalogSearch]=useState('');
  const [catalogSubject,setCatalogSubject]=useState('');
  const [versionId,setVersionId]=useState('');
  const [exam,setExam]=useState<Exam|null>(null);
  const [attempt,setAttempt]=useState<Attempt|null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [currentQuestion,setCurrentQuestion]=useState(0);
  const [reviewBeforeSubmit,setReviewBeforeSubmit]=useState(false);
  const [hideAnswered,setHideAnswered]=useState(false);
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
  async function loadHistory(offset=0){
    setBusy(true);setMessage('');
    try{const data=await api<{attempts:typeof history}>('/attempts?'+new URLSearchParams({limit:'20',offset:String(offset)}));setHistory(data.attempts);setHistoryOffset(offset);setHistoryOpen(true);}
    catch(error){setMessage('Không thể tải lịch sử làm bài: '+String(error));}finally{setBusy(false);}
  }
  async function showCatalog(){
    setBusy(true);setMessage('');
    try{
      const data=await api<{exams:Array<{versionId:string;title:string;subject:string;questionCount:number;durationMinutes:number}>}>('/exam-catalog');
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
    if(!attempt)return;
    setBusy(true);setMessage('');
    const key=window.crypto.randomUUID();
    try{
      await queueSave();
      const current=latestAttempt.current;
      if(!current)throw new Error('Không tìm thấy lượt thi');
      const data=await api<{result:Result}>('/attempts/'+current.id+'/submit',{method:'POST',body:JSON.stringify({saveVersion:current.saveVersion,idempotencyKey:key})});
      setReviewBeforeSubmit(false);setResult(data.result);sessionStorage.removeItem('studyweb_active_attempt');setResumeAvailable(false);
    }catch(e){setMessage(String(e)+' — Bài chưa được xác nhận nộp. Kiểm tra trạng thái lưu và kết quả trước khi thử lại.');}finally{setBusy(false);}
  }
  return <main className={signedIn?'shell study-layout':'shell'}>
    {signedIn&&<aside className="study-sidebar" aria-label="Điều hướng chính">
      <div className="study-logo"><span aria-hidden="true">🎓</span><strong>LTStudy</strong></div>
      <div className="study-role">{isAdmin?'Không gian quản trị':'Không gian học viên'}</div>
      <nav className="study-menu" aria-label="Danh mục">
        {isAdmin?<><button type="button" className={workspace==='overview'?'selected':''} onClick={()=>setWorkspace('overview')}>▦ <span>Tổng quan</span></button><button type="button" className={workspace==='users'?'selected':''} onClick={()=>setWorkspace('users')}>♙ <span>Quản lý người dùng</span></button><button type="button" className={workspace==='authoring'?'selected':''} onClick={()=>setWorkspace('authoring')}>▤ <span>Ngân hàng câu hỏi</span></button><button type="button" className={workspace==='exams'?'selected':''} onClick={()=>setWorkspace('exams')}>▣ <span>Quản lý đề thi</span></button></>:<><button type="button" onClick={()=>void showCatalog()}>⌂ <span>Trang chủ</span></button><button type="button" onClick={()=>void showCatalog()}>▣ <span>Đề thi</span></button><button type="button" onClick={()=>{const element=document.getElementById('student-history');element?.scrollIntoView({behavior:'smooth'});}}>◷ <span>Lịch sử</span></button></>}
      </nav>
      <div className="study-sidebar-footer"><span className="study-avatar">LT</span><span>{isAdmin?'Quản trị viên':'Học viên'}</span></div>
    </aside>}
    <div className="study-main">
    <header className="study-topbar"><span className="brand">{signedIn?'LTStudy':'Studyweb'}</span><span className="subtle">Không gian ôn tập và thi trực tuyến</span></header>
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
    {signedIn&&!isAdmin&&<section className="panel student-home" aria-label="Trang chủ học viên">
      <div className="student-hero"><div><span className="student-eyebrow">LTStudy · Học tập mỗi ngày</span><h1>Chào mừng trở lại 👋</h1><p>Tiếp tục ôn tập và kiểm tra kiến thức theo tiến độ của bạn.</p></div><div className="student-hero-badge"><span>Đề thi đã tải</span><strong>{catalog.length}</strong><small>Dữ liệu từ hệ thống</small></div></div>
      <div className="student-shortcuts">
        <button type="button" className="student-shortcut blue" disabled={busy} onClick={()=>void showCatalog()}><span className="shortcut-symbol">▣</span><strong>Đề thi</strong><small>Khám phá đề thi đã xuất bản</small></button>
        <button type="button" className="student-shortcut pink" disabled={busy} onClick={()=>void loadHistory(0)}><span className="shortcut-symbol">◷</span><strong>Lịch sử</strong><small>Xem kết quả đã làm</small></button>
        <button type="button" className="student-shortcut mint" disabled={busy||!resumeAvailable} onClick={()=>void resume()}><span className="shortcut-symbol">↻</span><strong>Tiếp tục bài thi</strong><small>{resumeAvailable?'Khôi phục bài thi đang làm':'Chưa có bài thi cần khôi phục'}</small></button>
      </div>
      <div className="student-section-title"><h2>Môn học có đề thi</h2><button type="button" className="secondary" disabled={busy} onClick={()=>void showCatalog()}>Làm mới danh sách</button></div>
      {catalog.length===0?<p className="student-empty">Chọn “Đề thi” để tải danh sách môn học và đề thi hiện có.</p>:<div className="student-course-grid">{Array.from(new Set(catalog.map(item=>item.subject))).map((subject,index)=>{const items=catalog.filter(item=>item.subject===subject);return <article className="student-course" key={subject}><div className={'student-course-art art-'+index%4} aria-hidden="true">{['⚖','📘','📈','🎓'][index%4]}</div><div className="student-course-body"><h3>{subject}</h3><p>{items.length} đề thi đã xuất bản</p><button type="button" className="secondary" onClick={()=>{setCatalogSubject(subject);document.getElementById('student-exam-room')?.scrollIntoView({behavior:'smooth'});}}>Xem đề thi</button></div></article>;})}</div>}
    </section>}
    {signedIn&&!isAdmin&&<section className="panel student-insights" aria-label="Thống kê kết quả học tập">
      <div className="student-section-title"><div><h2>Kết quả học tập của tôi</h2><p>Tổng quan các lượt thi trong trang lịch sử đã tải.</p></div><button type="button" className="secondary" disabled={busy} onClick={()=>void loadHistory(0)}>Cập nhật kết quả</button></div>
      {!historyOpen?<p className="student-empty">Chọn “Cập nhật kết quả” để xem thống kê từ lịch sử làm bài của bạn.</p>:<div className="student-insights-grid">
        <article><span>Lượt thi đã tải</span><strong>{history.length}</strong><small>{history.length===20?'Đang hiển thị 20 lượt gần nhất':'Lượt thi trong trang lịch sử hiện tại'}</small></article>
        <article><span>Đã nộp bài</span><strong>{history.filter(item=>item.status==='submitted').length}</strong><small>Trong trang lịch sử hiện tại</small></article>
        <article><span>Điểm trung bình</span><strong>{(()=>{const scored=history.filter(item=>item.points!==null&&item.maxPoints!==null&&item.maxPoints>0);return scored.length?(scored.reduce((sum,item)=>sum+(item.points??0)/(item.maxPoints??1)*100,0)/scored.length).toFixed(1)+'%':'—';})()}</strong><small>Chỉ tính các bài đã có điểm</small></article>
      </div>}
    </section>}
    {signedIn&&isAdmin&&<section className="panel admin-home">
      <div className="admin-home-heading"><div><span className="admin-eyebrow">LTStudy · Quản trị</span><h1>Không gian quản trị</h1><p>Quản lý nội dung học tập và tổ chức thi trực tuyến.</p></div><span className="admin-live">Hệ thống trực tuyến</span></div>
      <nav className="admin-navigation" aria-label="Điều hướng quản trị">
        <button className={workspace==='overview'?'':'secondary'} onClick={()=>setWorkspace('overview')}>Tổng quan</button>
        <button className={workspace==='authoring'?'':'secondary'} onClick={()=>setWorkspace('authoring')}>Tạo đề thi</button><button className={workspace==='users'?'':'secondary'} onClick={()=>setWorkspace('users')}>Người dùng</button>
        <button className={workspace==='exams'?'':'secondary'} onClick={()=>setWorkspace('exams')}>Phòng thi</button>
      </nav>
      {workspace==='overview'&&<div className="admin-overview-grid">
        <article><span className="admin-stat-icon">📚</span><h2>Khóa học và môn học</h2><p>Phân chia môn học và chủ đề để xây dựng ngân hàng câu hỏi.</p><button onClick={()=>setWorkspace('authoring')}>Quản lý nội dung</button></article>
        <article><span className="admin-stat-icon">📝</span><h2>Ngân hàng câu hỏi</h2><p>Soạn câu hỏi trắc nghiệm, đáp án đúng và phần giải thích.</p><button onClick={()=>setWorkspace('authoring')}>Biên soạn câu hỏi</button></article>
        <article><span className="admin-stat-icon">🎓</span><h2>Đề thi trực tuyến</h2><p>Tạo phiên bản nháp, ghép câu hỏi và xuất bản đề thi.</p><button onClick={()=>setWorkspace('authoring')}>Tạo đề mới</button></article>
      </div>}
    </section>}
    {signedIn&&isAdmin&&workspace==='authoring'&&<AdminPanel/>}
    {signedIn&&isAdmin&&workspace==='users'&&<UserDirectory/>}
    {signedIn&&(!isAdmin||workspace==='exams')&&<section className="panel" id="student-history"><div className="toolbar"><h2>Lịch sử làm bài</h2><button className="secondary" disabled={busy} onClick={()=>void loadHistory(0)}>{historyOpen?'Làm mới':'Xem lịch sử'}</button></div>
      {historyOpen&&<><div className="history-summary"><article><span>Lượt thi trong trang</span><strong>{history.length}</strong></article><article><span>Đã nộp</span><strong>{history.filter(item=>item.status==='submitted').length}</strong></article><article><span>Đang làm</span><strong>{history.filter(item=>item.status==='active').length}</strong></article></div><div className="history-list">{history.map(item=><article className="bank-question history-entry" key={item.id}><strong>{item.status==='submitted'?'Đã nộp':item.status==='active'?'Đang làm':'Đã kết thúc'}</strong><p>Bắt đầu: {new Date(item.startedAt*1000).toLocaleString('vi-VN')}</p><p>{item.points!==null&&item.maxPoints!==null?'Điểm: '+item.points+'/'+item.maxPoints:'Chưa có kết quả chấm điểm'}</p><small>Mã phiên bản: {item.versionId}</small></article>)}{history.length===0&&<p>Chưa có lượt thi trong trang này.</p>}</div><div className="toolbar"><button className="secondary" disabled={busy||historyOffset===0} onClick={()=>void loadHistory(Math.max(0,historyOffset-20))}>Trang trước</button><button className="secondary" disabled={busy||history.length<20} onClick={()=>void loadHistory(historyOffset+20)}>Trang tiếp</button></div></>}
    </section>}
    {signedIn&&(!isAdmin||workspace==='exams')&&resumeAvailable&&!attempt&&<section className="panel"><h2>Bài thi đang làm</h2><p>Khôi phục câu trả lời đã lưu trên máy chủ sau khi tải lại trang.</p><button disabled={busy} onClick={resume}>Tiếp tục bài thi</button></section>}
    {signedIn&&(!isAdmin||workspace==='exams')&&<section className="panel" id="student-exam-room"><h1>Phòng thi trực tuyến</h1><p>Nhập mã phiên bản đề thi đã xuất bản. Bạn có thể tải đề thi bằng mã phiên bản đã xuất bản.</p>
      <div className="toolbar"><button disabled={busy} onClick={showCatalog}>Xem danh sách đề thi</button></div>
      {catalog.length>0&&<div className="toolbar"><label>Tìm đề thi<input value={catalogSearch} placeholder="Tên đề hoặc môn học" onChange={e=>setCatalogSearch(e.target.value)}/></label><label>Lọc môn học<select value={catalogSubject} onChange={e=>setCatalogSubject(e.target.value)}><option value="">Tất cả môn học</option>{Array.from(new Set(catalog.map(item=>item.subject))).sort().map(name=><option key={name} value={name}>{name}</option>)}</select></label></div>}
      <div className="exam-catalog-list">{catalog.filter(item=>(!catalogSubject||item.subject===catalogSubject)&&(item.title+' '+item.subject).toLocaleLowerCase('vi').includes(catalogSearch.trim().toLocaleLowerCase('vi'))).map(item=><button key={item.versionId} className={versionId===item.versionId?'':'secondary'} disabled={busy} onClick={()=>setVersionId(item.versionId)}>{item.subject} — {item.title} ({item.questionCount} câu · {item.durationMinutes} phút)</button>)}</div>
      {catalog.length>0&&catalog.filter(item=>(!catalogSubject||item.subject===catalogSubject)&&(item.title+' '+item.subject).toLocaleLowerCase('vi').includes(catalogSearch.trim().toLocaleLowerCase('vi'))).length===0&&<p>Không tìm thấy đề thi phù hợp.</p>}
      <div className="toolbar"><input aria-label="Mã phiên bản đề thi" placeholder="Mã phiên bản đề thi (UUID)" value={versionId} onChange={e=>setVersionId(e.target.value)}/><button disabled={busy||!versionId} onClick={loadExam}>Tải đề thi</button></div>
    </section>}
    {signedIn&&(!isAdmin||workspace==='exams')&&exam&&<section className="panel"><div className="toolbar"><h2>Đề thi · {exam.questions.length} câu · {exam.version.durationMinutes} phút</h2>{!attempt&&<button disabled={busy} onClick={start}>Bắt đầu làm bài</button>}</div>
      {attempt&&<div className="status"><span>Thời gian còn lại: <strong>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong></span><span>Phiên bản lưu: {attempt.saveVersion} · {({idle:'Chưa thay đổi',pending:'Chờ lưu',saving:'Đang lưu',saved:'Đã lưu',error:'Lưu thất bại'} as const)[saveState]}</span></div>}
      <div className="exam-progress" aria-live="polite"><strong>Đã trả lời {exam.questions.filter(({position})=>Boolean(answers[String(position)])).length}/{exam.questions.length} câu</strong><span>Đang xem câu {Math.min(currentQuestion+1,exam.questions.length)}/{exam.questions.length}</span></div>
      <div className="exam-progress-track" role="progressbar" aria-label="Tiến độ trả lời" aria-valuemin={0} aria-valuemax={exam.questions.length} aria-valuenow={exam.questions.filter(({position})=>Boolean(answers[String(position)])).length}><div style={{width:(exam.questions.length?exam.questions.filter(({position})=>Boolean(answers[String(position)])).length/exam.questions.length*100:0)+'%'}}/></div>
      <div className="toolbar"><label className="inline-check"><input type="checkbox" checked={hideAnswered} onChange={e=>setHideAnswered(e.target.checked)}/> Chỉ hiện câu chưa trả lời trong bảng điều hướng</label><button type="button" className="secondary" onClick={()=>{const index=exam.questions.findIndex(({position})=>!answers[String(position)]);if(index>=0)setCurrentQuestion(index);}}>Đến câu chưa trả lời đầu tiên</button></div>
      <nav className="question-navigation" aria-label="Chọn câu hỏi">
        {exam.questions.map(({position},index)=>(hideAnswered&&answers[String(position)]?null:<button key={position} type="button" aria-current={index===currentQuestion?'step':undefined} aria-label={'Câu '+(position+1)+(answers[String(position)]?' đã trả lời':' chưa trả lời')} className={index===currentQuestion?'question-current':answers[String(position)]?'question-answered':'secondary'} onClick={()=>setCurrentQuestion(index)}>{position+1}</button>))}
      </nav>
      {exam.questions.filter((_,index)=>index===currentQuestion).map(({position,question})=><article className="question" key={position}><h3>Câu {position+1}. {question.body}</h3>
        {question.options.map(option=><label className="option" key={option.label}><input type="radio" name={'q'+position} disabled={!attempt||!!result||remaining===0} checked={answers[String(position)]===option.label} onChange={()=>setAnswers(prev=>({...prev,[String(position)]:option.label}))}/><span>{option.label}. {option.text}</span></label>)}</article>)}
      {attempt&&!result&&remaining>0&&<div className="toolbar"><button type="button" className="secondary" disabled={!answers[String(exam.questions[currentQuestion]?.position)]} onClick={()=>{const position=exam.questions[currentQuestion]?.position;if(position!==undefined)setAnswers(prev=>{const next={...prev};delete next[String(position)];return next;});}}>Xóa lựa chọn của câu này</button></div>}
      {attempt&&!result&&<ReviewFlags attemptId={attempt.id} positions={exam.questions.map(item=>item.position)} currentPosition={exam.questions[currentQuestion]?.position??0} onNavigate={position=>{const index=exam.questions.findIndex(item=>item.position===position);if(index>=0)setCurrentQuestion(index);}}/>}
      <div className="toolbar question-controls"><button className="secondary" disabled={currentQuestion===0} onClick={()=>setCurrentQuestion(index=>Math.max(0,index-1))}>Câu trước</button><button className="secondary" disabled={currentQuestion>=exam.questions.length-1} onClick={()=>setCurrentQuestion(index=>Math.min(exam.questions.length-1,index+1))}>Câu tiếp</button></div>
      {attempt&&!result&&<div className="toolbar"><button className="secondary" disabled={busy} onClick={recover}>Khôi phục đáp án</button><button disabled={busy||remaining===0} onClick={save}>Lưu bài</button><button className="danger" disabled={busy||remaining===0} onClick={()=>setReviewBeforeSubmit(true)}>Nộp bài</button></div>}
      {attempt&&!result&&reviewBeforeSubmit&&<section className="submission-review" aria-label="Kiểm tra trước khi nộp bài"><h3>Xác nhận nộp bài</h3><p>Đã trả lời {exam.questions.filter(({position})=>Boolean(answers[String(position)])).length}/{exam.questions.length} câu. Sau khi nộp, bạn không thể sửa đáp án.</p><strong>Câu chưa trả lời</strong><div className="question-navigation">{exam.questions.filter(({position})=>!answers[String(position)]).map(({position})=><button type="button" className="secondary" key={position} onClick={()=>{const index=exam.questions.findIndex(item=>item.position===position);if(index>=0)setCurrentQuestion(index);setReviewBeforeSubmit(false);}}>Câu {position+1}</button>)}{exam.questions.every(({position})=>Boolean(answers[String(position)]))&&<span>Không có câu bỏ trống.</span>}</div><div className="toolbar"><button type="button" className="secondary" onClick={()=>setReviewBeforeSubmit(false)}>Quay lại bài thi</button><button type="button" className="danger" disabled={busy||remaining===0} onClick={()=>void submit()}>Xác nhận nộp bài</button></div></section>}
    </section>}
    {signedIn&&(!isAdmin||workspace==='exams')&&result&&<section className="panel"><h2>Kết quả bài thi</h2><p className="score">{result.points} / {result.maxPoints}</p><p>Đã nộp: {new Date(result.submittedAt*1000).toLocaleString('vi-VN')}</p></section>}
    {message&&<p role="alert" className="notice">{message}</p>}
    </div>
  </main>;
}
