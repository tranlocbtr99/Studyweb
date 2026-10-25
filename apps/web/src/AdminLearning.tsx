import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
type LearningItem={id:string;subjectId:string;title:string;body:string;position?:number;url?:string;status:'draft'|'published'|'archived';updatedAt:number};
type Subject={id:string;title:string;slug:string};
export default function AdminLearning(){
 const [items,setItems]=useState<LearningItem[]>([]);
 const [editingId,setEditingId]=useState('');
 const [offset,setOffset]=useState(0);
 const [total,setTotal]=useState(0);
 const [revision,setRevision]=useState(0);
 const [loading,setLoading]=useState(false);
 const [listError,setListError]=useState('');
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
 function resetEditor(){setEditingId('');setTitle('');setBody('');setUrl('');setPosition(0);setStatus('draft')}
 useEffect(()=>{
  setItems([]);setTotal(0);setListError('');
  if(!subjectId)return;
  let active=true;const controller=new AbortController();setLoading(true);
  fetch('/api/v1/admin/learning?'+new URLSearchParams({subjectId,kind,offset:String(offset)}),{credentials:'same-origin',signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error('LOAD_FAILED');return r.json() as Promise<{items:LearningItem[];total:number}>})
   .then(data=>{if(active){setItems(data.items);setTotal(data.total)}})
   .catch(()=>{if(active)setListError('Không tải được nội dung đã lưu.')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;controller.abort()};
 },[subjectId,kind,offset,revision]);
 function edit(item:LearningItem){
  setEditingId(item.id);setTitle(item.title);setBody(item.body);setUrl(item.url??'');setPosition(item.position??0);
  setStatus(item.status==='published'?'published':'draft');setMessage('');
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   const path=kind==='lesson'?'lessons':'materials';
   const payload=kind==='lesson'?{subjectId,title,body,position,status}:{subjectId,title,description:body,url,status};
   const res=await fetch('/api/v1/admin/learning/'+path+(editingId?'/'+editingId:''),{method:editingId?'PUT':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(!res.ok)throw Error('HTTP '+res.status);
   resetEditor();setRevision(value=>value+1);setOffset(0);setMessage('Đã lưu '+(status==='published'?'và xuất bản.':'bản nháp.'));
  }catch{setMessage('Không thể lưu. Kiểm tra dữ liệu và quyền truy cập.')}finally{setBusy(false)}
 }
 return <section className="panel" aria-label="Quản lý nội dung học tập">
  <h2>Biên soạn bài học và tài liệu</h2><p>Chọn môn học, nhập nội dung và quyết định lưu nháp hoặc xuất bản cho học viên.</p>
  {editingId&&<p role="status">Đang chỉnh sửa: {title}</p>}
  <form onSubmit={event=>void save(event)} className="admin-learning-form"><fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'contents'}}>
   <label>Môn học<select required value={subjectId} disabled={!!editingId} onChange={e=>{setSubjectId(e.target.value);setOffset(0);resetEditor()}}><option value="">Chọn môn học</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
   <label>Loại nội dung<select value={kind} disabled={!!editingId} onChange={e=>{setKind(e.target.value as 'lesson'|'material');setOffset(0);resetEditor()}}><option value="lesson">Bài học</option><option value="material">Tài liệu</option></select></label>
   <label>Tiêu đề<input required minLength={2} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label>{kind==='lesson'?'Nội dung bài học':'Mô tả tài liệu'}<textarea rows={6} maxLength={kind==='lesson'?30000:2000} value={body} onChange={e=>setBody(e.target.value)}/></label>
   {kind==='material'&&<label>Liên kết HTTPS<input required type="url" pattern="https://.*" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label>}
   {kind==='lesson'&&<label>Thứ tự bài học<input type="number" min={0} max={10000} value={position} onChange={e=>setPosition(Number(e.target.value))}/></label>}
   <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value as 'draft'|'published')}><option value="draft">Lưu nháp</option><option value="published">Xuất bản</option></select></label>
   <button disabled={busy||!subjectId} type="submit">{busy?'Đang lưu…':editingId?'Lưu thay đổi':'Lưu nội dung'}</button>
   {editingId&&<button type="button" className="secondary" onClick={resetEditor}>Hủy chỉnh sửa</button>}
  </fieldset></form>
  {message&&<p role="status">{message}</p>}
  {subjectId&&<section aria-label="Nội dung đã lưu">
   <h3>{kind==='lesson'?'Bài học':'Tài liệu'} đã lưu · {total}</h3>
   <button type="button" className="secondary" disabled={loading||busy} onClick={()=>setRevision(value=>value+1)}>Tải lại danh sách</button>
   {loading?<p role="status">Đang tải…</p>:listError?<p role="alert">{listError}</p>:items.length?<div className="subject-exam-list">{items.map(item=><article key={item.id} className="subject-exam-card"><div><h4>{item.title}</h4><p>{item.status==='published'?'Đã xuất bản':item.status==='archived'?'Đã lưu trữ':'Bản nháp'}{kind==='lesson'?' · Thứ tự '+item.position:''}</p></div><button type="button" disabled={busy||item.status==='archived'} onClick={()=>edit(item)}>Chỉnh sửa</button></article>)}</div>:<p>Chưa có nội dung ở trang này.</p>}
   <div className="actions"><button type="button" disabled={offset===0||loading||busy} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Trang trước</button><span>Trang {Math.floor(offset/20)+1}</span><button type="button" disabled={offset+20>=total||loading||busy} onClick={()=>setOffset(value=>value+20)}>Trang sau</button></div>
  </section>}
 </section>;
}
