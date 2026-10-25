import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {Discussion} from './Community';
type LearningItem={id:string;subjectId:string;title:string;body:string;position?:number;url?:string;status:'draft'|'published'|'archived';updatedAt:number};
type Subject={id:string;title:string;slug:string};
export default function AdminLearning(){
 const editorRef=useRef<HTMLFormElement>(null);
 const titleRef=useRef<HTMLInputElement>(null);
 const [preview,setPreview]=useState(false);
 const [baseline,setBaseline]=useState(JSON.stringify({title:'',body:'',url:'',position:0,status:'draft'}));
 const [filterStatus,setFilterStatus]=useState('all');
 const [searchInput,setSearchInput]=useState('');
 const [search,setSearch]=useState('');
 const [pendingStatus,setPendingStatus]=useState<LearningItem|null>(null);
 const [items,setItems]=useState<LearningItem[]>([]);
 const [editingId,setEditingId]=useState('');
 const [offset,setOffset]=useState(0);
 const [total,setTotal]=useState(0);
 const [revision,setRevision]=useState(0);
 const [loading,setLoading]=useState(false);
 const [listError,setListError]=useState('');
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [subjectId,setSubjectId]=useState('');
 const [subjectName,setSubjectName]=useState('');
 const [kind,setKind]=useState<'lesson'|'material'>('lesson');
 const [title,setTitle]=useState('');
 const [body,setBody]=useState('');
 const [url,setUrl]=useState('');
 const [position,setPosition]=useState(0);
 const [status,setStatus]=useState<'draft'|'published'>('draft');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/v1/admin/subjects',{credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('LOAD_FAILED');return r.json() as Promise<{subjects:Subject[]}>}).then(data=>{if(active)setSubjects(data.subjects)}).catch(()=>{if(active)setMessage('Không tải được danh sách môn học')});return()=>{active=false}},[]);
 const dirty=JSON.stringify({title,body,url,position,status})!==baseline;
 useEffect(()=>{
  if(!dirty)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[dirty]);
 function discardChanges(){return !dirty||window.confirm('Nội dung chưa được lưu. Bỏ thay đổi để tiếp tục?')}
 function resetEditor(){setPreview(false);setBaseline(JSON.stringify({title:'',body:'',url:'',position:0,status:'draft'}));setEditingId('');setTitle('');setBody('');setUrl('');setPosition(0);setStatus('draft')}
 useEffect(()=>{
  setItems([]);setTotal(0);setListError('');
  if(!subjectId)return;
  let active=true;const controller=new AbortController();setLoading(true);
  fetch('/api/v1/admin/learning?'+new URLSearchParams({subjectId,kind,offset:String(offset),status:filterStatus,search}),{credentials:'same-origin',signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error('LOAD_FAILED');return r.json() as Promise<{items:LearningItem[];total:number}>})
   .then(data=>{if(active){setItems(data.items);setTotal(data.total)}})
   .catch(()=>{if(active)setListError('Không tải được nội dung đã lưu.')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;controller.abort()};
 },[subjectId,kind,offset,revision,filterStatus,search]);
 function edit(item:LearningItem,duplicate=false){
  if(!discardChanges())return;
  setPreview(false);
  setPendingStatus(null);
  const nextTitle=duplicate?(item.title.slice(0,149)+' (bản sao)'):item.title;
  const nextStatus=duplicate?'draft':item.status==='published'?'published':'draft';
  setBaseline(JSON.stringify({title:duplicate?'':nextTitle,body:duplicate?'':item.body,url:duplicate?'':item.url??'',position:duplicate?0:item.position??0,status:duplicate?'draft':nextStatus}));
  setEditingId(duplicate?'':item.id);setTitle(nextTitle);setBody(item.body);setUrl(item.url??'');setPosition(item.position??0);
  setStatus(nextStatus);setMessage(duplicate?'Đã tạo bản sao trong trình soạn. Nhấn Lưu nội dung để lưu bản nháp mới.':'');
  editorRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
  titleRef.current?.focus({preventScroll:true});
 }
 async function changeStatus(){
  if(!pendingStatus||busy)return;
  const item=pendingStatus;
  if(editingId===item.id&&!discardChanges())return;
  setBusy(true);setMessage('');
  try{
   const nextStatus=item.status==='archived'?'draft':'archived';
   const res=await fetch('/api/v1/admin/learning/'+(kind==='lesson'?'lessons':'materials')+'/'+item.id+'/status',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:nextStatus})});
   if(!res.ok)throw Error('HTTP '+res.status);
   if(editingId===item.id)resetEditor();
   setPendingStatus(null);setOffset(0);setRevision(value=>value+1);
   setMessage(nextStatus==='draft'?'Đã khôi phục thành bản nháp.':'Đã lưu trữ nội dung.');
  }catch{setMessage('Không thể đổi trạng thái. Hãy tải lại danh sách và thử lại.')}
  finally{setBusy(false)}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');
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
  <form ref={editorRef} onSubmit={event=>void save(event)} className="admin-learning-form"><fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'contents'}}>
   <label>Nhập tên môn học<input list="learning-subject-names" required maxLength={160} value={subjectName} disabled={!!editingId} onChange={event=>{if(!discardChanges())return;setSubjectName(event.target.value);setSubjectId(subjects.find(subject=>subject.title===event.target.value)?.id??'');setOffset(0);setPendingStatus(null);resetEditor()}} placeholder="Nhập tên môn học"/><datalist id="learning-subject-names">{subjects.map(subject=><option key={subject.id} value={subject.title}/>)}</datalist></label>
   {!subjectId&&<button type="button" className="secondary" disabled={busy||subjectName.trim().length<2} onClick={()=>{setBusy(true);setMessage('');void fetch('/api/v1/admin/subjects',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:subjectName})}).then(async response=>{if(!response.ok)throw Error();return response.json() as Promise<{subject:Subject}>}).then(data=>{setSubjects(previous=>[...previous.filter(subject=>subject.id!==data.subject.id),data.subject]);setSubjectId(data.subject.id);setSubjectName(data.subject.title);setMessage('Đã lưu môn học.')}).catch(()=>setMessage('Không thể lưu môn học.')).finally(()=>setBusy(false))}}>Lưu môn học</button>}
   <label>Loại nội dung<select value={kind} disabled={!!editingId} onChange={e=>{if(!discardChanges())return;setPendingStatus(null);setKind(e.target.value as 'lesson'|'material');setOffset(0);resetEditor()}}><option value="lesson">Bài học</option><option value="material">Tài liệu</option></select></label>
   <label>Tiêu đề<input ref={titleRef} required minLength={2} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label>{kind==='lesson'?'Nội dung bài học':'Mô tả tài liệu'}<textarea rows={6} maxLength={kind==='lesson'?30000:2000} value={body} onChange={e=>setBody(e.target.value)}/></label>
   {kind==='material'&&<label>Liên kết HTTPS<input required type="url" pattern="https://.*" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label>}
   {kind==='lesson'&&<label>Thứ tự bài học<input type="number" min={0} max={10000} value={position} onChange={e=>setPosition(Number(e.target.value))}/></label>}
   <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value as 'draft'|'published')}><option value="draft">Lưu nháp</option><option value="published">Xuất bản</option></select></label>
   <p>{body.length.toLocaleString('vi')} / {(kind==='lesson'?30000:2000).toLocaleString('vi')} ký tự{dirty?' · Có thay đổi chưa lưu':''}</p>
   <button type="button" className="secondary" aria-expanded={preview} onClick={()=>setPreview(value=>!value)}>{preview?'Ẩn xem trước':'Xem trước nội dung'}</button>
   <button disabled={busy||!subjectId} type="submit">{busy?'Đang lưu…':editingId?'Lưu thay đổi':'Lưu nội dung'}</button>
   {editingId&&<button type="button" className="secondary" onClick={()=>{if(discardChanges())resetEditor()}}>Hủy chỉnh sửa</button>}
  </fieldset></form>
  {preview&&<section className="panel" aria-label="Xem trước nội dung học viên">
   <p>Xem trước · {subjects.find(item=>item.id===subjectId)?.title??'Chưa chọn môn học'}</p>
   <h3>{title||'Chưa có tiêu đề'}</h3>
   <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.8}}>{body||'Chưa có nội dung'}</div>
   {kind==='material'&&(()=>{try{const link=new URL(url);return link.protocol==='https:'?<p><a href={link.href} target="_blank" rel="noopener noreferrer">Mở tài liệu</a></p>:<p>Nhập liên kết HTTPS hợp lệ để xem trước.</p>}catch{return <p>Nhập liên kết HTTPS hợp lệ để xem trước.</p>}})()}
   <p>{status==='draft'?'Bản nháp chưa hiển thị cho học viên.':'Nội dung sẽ hiển thị cho học viên sau khi lưu thành công.'}</p>
  </section>}
  {message&&<p role="status">{message}</p>}
  {subjectId&&<details className="panel"><summary>Kiểm duyệt thảo luận môn học</summary><Discussion key={subjectId} subjectId={subjectId} admin/></details>}
  {subjectId&&<section aria-label="Nội dung đã lưu">
   <form className="actions" onSubmit={event=>{event.preventDefault();setSearch(searchInput.trim());setOffset(0)}}>
    <label>Tìm tiêu đề<input type="search" maxLength={160} value={searchInput} onChange={e=>setSearchInput(e.target.value)}/></label>
    <button type="submit" disabled={busy}>Tìm kiếm</button>
    {(searchInput||search||filterStatus!=='all')&&<button type="button" className="secondary" disabled={busy} onClick={()=>{setSearchInput('');setSearch('');setFilterStatus('all');setOffset(0)}}>Xóa bộ lọc</button>}
    <label>Trạng thái<select value={filterStatus} disabled={busy} onChange={e=>{setFilterStatus(e.target.value);setOffset(0)}}><option value="all">Tất cả</option><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option><option value="archived">Đã lưu trữ</option></select></label>
   </form>
   {pendingStatus&&<div className="panel" role="group" aria-label="Xác nhận đổi trạng thái"><p>{pendingStatus.status==='archived'?'Khôi phục thành bản nháp: ':'Lưu trữ và ẩn khỏi học viên: '}{pendingStatus.title}?</p><button type="button" disabled={busy} onClick={()=>void changeStatus()}>Xác nhận</button><button type="button" className="secondary" disabled={busy} onClick={()=>setPendingStatus(null)}>Hủy</button></div>}
   <h3>{kind==='lesson'?'Bài học':'Tài liệu'} đã lưu · {total}</h3>
   {!loading&&!listError&&total>0&&<p>Hiển thị {offset+1}–{Math.min(offset+items.length,total)} / {total} kết quả</p>}
   <button type="button" className="secondary" disabled={loading||busy} onClick={()=>setRevision(value=>value+1)}>Tải lại danh sách</button>
   {loading?<p role="status">Đang tải…</p>:listError?<p role="alert">{listError}</p>:items.length?<div className="subject-exam-list">{items.map(item=><article key={item.id} className="subject-exam-card"><div><h4>{item.title}</h4><p>{item.status==='published'?'Đã xuất bản':item.status==='archived'?'Đã lưu trữ':'Bản nháp'}{kind==='lesson'?' · Thứ tự '+item.position:''}</p>
     <p>Cập nhật: <time dateTime={new Date(item.updatedAt*1000).toISOString()}>{new Date(item.updatedAt*1000).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</time></p>
     <details><summary style={{cursor:'pointer'}}>Xem nội dung đã lưu</summary>
      <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.8,maxHeight:360,overflowY:'auto',marginTop:12}}>{item.body||'Chưa có nội dung'}</div>
      {kind==='material'&&(()=>{try{const link=new URL(item.url??'');return link.protocol==='https:'?<p><a href={link.href} target="_blank" rel="noopener noreferrer">Mở tài liệu</a></p>:null}catch{return null}})()}
     </details>
    </div><button type="button" disabled={busy||item.status==='archived'} onClick={()=>edit(item)}>Chỉnh sửa</button><button type="button" className="secondary" disabled={busy} onClick={()=>edit(item,true)}>Tạo bản sao</button><button type="button" className="secondary" disabled={busy} onClick={()=>setPendingStatus(item)}>{item.status==='archived'?'Khôi phục':'Lưu trữ'}</button></article>)}</div>:<p>Chưa có nội dung ở trang này.</p>}
   <div className="actions"><button type="button" disabled={offset===0||loading||busy} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Trang trước</button><span>Trang {Math.floor(offset/20)+1}</span><button type="button" disabled={offset+20>=total||loading||busy} onClick={()=>setOffset(value=>value+20)}>Trang sau</button></div>
  </section>}
 </section>;
}

