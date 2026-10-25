import { useEffect, useState } from 'react';
type Subject={id:string;title:string;slug:string};
export default function AdminLearning(){
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [subjectId,setSubjectId]=useState('');
 const [kind,setKind]=useState<'lesson'|'material'>('lesson');
 const [title,setTitle]=useState('');
 const [body,setBody]=useState('');
 const [url,setUrl]=useState('');
 const [position,setPosition]=useState(0);
 const [status,setStatus]=useState<'draft'|'published'>('draft');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/v1/admin/subjects',{credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('LOAD_FAILED');return r.json() as Promise<{subjects:Subject[]}>}).then(data=>{if(active)setSubjects(data.subjects)}).catch(()=>{if(active)setMessage('Không tải được danh sách môn học')});return()=>{active=false}},[]);
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   const path=kind==='lesson'?'lessons':'materials';
   const payload=kind==='lesson'?{subjectId,title,body,position,status}:{subjectId,title,description:body,url,status};
   const res=await fetch('/api/v1/admin/learning/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(!res.ok)throw Error('HTTP '+res.status);
   setTitle('');setBody('');setUrl('');setMessage('Đã lưu '+(status==='published'?'và xuất bản.':'bản nháp.'));
  }catch{setMessage('Không thể lưu. Kiểm tra dữ liệu và quyền truy cập.')}finally{setBusy(false)}
 }
 return <section className="panel" aria-label="Quản lý nội dung học tập">
  <h2>Biên soạn bài học và tài liệu</h2><p>Chọn môn học, nhập nội dung và quyết định lưu nháp hoặc xuất bản cho học viên.</p>
  <form onSubmit={event=>void save(event)} className="admin-learning-form">
   <label>Môn học<select required value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">Chọn môn học</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
   <label>Loại nội dung<select value={kind} onChange={e=>setKind(e.target.value as 'lesson'|'material')}><option value="lesson">Bài học</option><option value="material">Tài liệu</option></select></label>
   <label>Tiêu đề<input required minLength={2} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label>{kind==='lesson'?'Nội dung bài học':'Mô tả tài liệu'}<textarea rows={6} maxLength={kind==='lesson'?30000:2000} value={body} onChange={e=>setBody(e.target.value)}/></label>
   {kind==='material'&&<label>Liên kết HTTPS<input required type="url" pattern="https://.*" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label>}
   {kind==='lesson'&&<label>Thứ tự bài học<input type="number" min={0} max={10000} value={position} onChange={e=>setPosition(Number(e.target.value))}/></label>}
   <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value as 'draft'|'published')}><option value="draft">Lưu nháp</option><option value="published">Xuất bản</option></select></label>
   <button disabled={busy||!subjectId} type="submit">{busy?'Đang lưu…':'Lưu nội dung'}</button>
  </form>
  {message&&<p role="status">{message}</p>}
 </section>;
}
