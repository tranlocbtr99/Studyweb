import { useEffect, useState } from 'react';
import {Discussion} from './Community';

type PublishedExam={versionId:string;title:string;subject:string;questionCount:number;durationMinutes:number};
type Props={subjectId?:string;subject:string;onProgress?:()=>void;exams:PublishedExam[];onClose:()=>void;onSelectExam:(versionId:string)=>void};
type Tab='exams'|'lessons'|'materials'|'discussion';

export default function SubjectDetail({subjectId,subject,exams,onClose,onSelectExam,onProgress}:Props){
 const [tab,setTab]=useState<Tab>('lessons');
 const [search,setSearch]=useState('');
 const [contentSearch,setContentSearch]=useState('');
 const [reload,setReload]=useState(0);
 const [contentOffset,setContentOffset]=useState(0);
 const [hasMore,setHasMore]=useState(false);
 const [lessons,setLessons]=useState<Array<{id:string;title:string;body:string;position:number;completed?:number}>>([]);
 const [materials,setMaterials]=useState<Array<{id:string;title:string;description:string;url:string}>>([]);
 const [contentError,setContentError]=useState('');
 const [savingProgress,setSavingProgress]=useState<string|null>(null);
 const [progressError,setProgressError]=useState('');
 const [loadingContent,setLoadingContent]=useState(true);
 useEffect(()=>{
  let cancelled=false;
  setLoadingContent(true);setContentError('');if(contentOffset===0){setLessons([]);setMaterials([])}
  const controller=new AbortController();
  fetch('/api/v1/student/learning-content?subject='+encodeURIComponent(subject)+'&offset='+contentOffset+(subjectId?'&subjectId='+encodeURIComponent(subjectId):''),{credentials:'same-origin',signal:controller.signal})
   .then(async res=>{if(!res.ok)throw new Error('HTTP '+res.status);return res.json() as Promise<{lessons:Array<{id:string;title:string;body:string;position:number;completed?:number}>;materials:Array<{id:string;title:string;description:string;url:string}>}>})
   .then(data=>{if(!cancelled){setHasMore(data.lessons.length===100||data.materials.length===100);setLessons(previous=>contentOffset===0?data.lessons:[...new Map([...previous,...data.lessons].map(item=>[item.id,item])).values()]);setMaterials(previous=>contentOffset===0?data.materials:[...new Map([...previous,...data.materials].map(item=>[item.id,item])).values()])}})
   .catch(()=>{if(!cancelled)setContentError('Không thể tải nội dung học tập. Vui lòng thử lại sau.')})
   .finally(()=>{if(!cancelled)setLoadingContent(false)});
  return()=>{cancelled=true;controller.abort()};
 },[subject,subjectId,reload,contentOffset]);
 useEffect(()=>{setSearch('');setContentSearch('');setTab('lessons');setContentOffset(0)},[subject]);
 async function toggleProgress(id:string,completed:boolean){
  if(savingProgress)return;setSavingProgress(id);setProgressError('');
  try{const response=await fetch('/api/v1/community/lessons/'+id+'/progress',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed})});if(!response.ok)throw Error();setLessons(previous=>previous.map(lesson=>lesson.id===id?{...lesson,completed:Number(completed)}:lesson));onProgress?.()}catch{setProgressError('Không thể lưu tiến độ. Vui lòng thử lại.')}finally{setSavingProgress(null)}
 }
 const normalizedSearch=contentSearch.trim().toLocaleLowerCase('vi');
 const visibleLessons=lessons.filter(item=>(item.title+' '+item.body).toLocaleLowerCase('vi').includes(normalizedSearch));
 const visibleMaterials=materials.filter(item=>(item.title+' '+item.description).toLocaleLowerCase('vi').includes(normalizedSearch));
 const visibleExams=exams.filter(exam=>exam.title.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
 const tabs:Array<{id:Tab;label:string}>=[{id:'lessons',label:'Bài học'},{id:'materials',label:'Tài liệu'},{id:'exams',label:'Đề thi'},...(subjectId?[{id:'discussion' as Tab,label:'Thảo luận'}]:[])];
 return <section className="panel subject-detail" aria-label={'Chi tiết môn học '+subject}>
   <div className="subject-detail-hero"><div><span className="subject-detail-eyebrow">LTMstu · Môn học</span><h2>{subject}</h2><p>{exams.length} đề thi đã xuất bản</p></div><button type="button" className="secondary" onClick={onClose}>Đóng</button></div>
   {!loadingContent&&!contentError&&lessons.length>0&&<div className="lesson-progress"><span>Đã hoàn thành {lessons.filter(lesson=>lesson.completed).length}/{lessons.length} bài đã tải</span><progress aria-label="Tiến độ các bài học đã tải" max={lessons.length} value={lessons.filter(lesson=>lesson.completed).length}/></div>}
   {progressError&&<p role="alert" className="notice">{progressError}</p>}
   <div className="subject-tabs" role="tablist" aria-label="Nội dung môn học">
     {tabs.map(item=><button key={item.id} type="button" role="tab" id={'subject-tab-'+item.id} aria-selected={tab===item.id} aria-controls="subject-tab-panel" className={tab===item.id?'selected':'secondary'} onClick={()=>setTab(item.id)}>{item.label}</button>)}
   </div>
   <div id="subject-tab-panel" role="tabpanel" aria-labelledby={'subject-tab-'+tab}>
    {tab==='exams'&&<label className="subject-exam-search">Tìm đề thi <input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nhập tên đề thi" /></label>}
    {tab==='exams'&&(visibleExams.length?<div className="subject-exam-list">{visibleExams.map(exam=><article key={exam.versionId} className="subject-exam-card"><div><h3>{exam.title}</h3><p>{exam.questionCount} câu hỏi · {exam.durationMinutes} phút</p></div><button type="button" onClick={()=>onSelectExam(exam.versionId)}>Chọn đề thi</button></article>)}</div>:<p>{search.trim()?'Không tìm thấy đề thi phù hợp.':'Chưa có đề thi được xuất bản cho môn học này.'}</p>)}
    {(tab==='lessons'||tab==='materials')&&<label className="subject-exam-search">Tìm {tab==='lessons'?'bài học':'tài liệu'}<input type="search" value={contentSearch} onChange={event=>setContentSearch(event.target.value)} placeholder="Nhập tiêu đề hoặc nội dung"/></label>}
    {tab==='lessons'&&(loadingContent?<p>Đang tải bài học…</p>:contentError?<div role="alert"><p>{contentError}</p><button type="button" onClick={()=>setReload(value=>value+1)}>Thử tải lại</button></div>:visibleLessons.length?<div className="subject-exam-list"><p>{visibleLessons.length} / {lessons.length} bài học · Nhấn tiêu đề để đọc</p>{visibleLessons.map(lesson=><details className="panel" key={subject+lesson.id}><summary style={{cursor:'pointer',fontWeight:600}}>{lesson.completed?'✓ ':''}{lesson.title}</summary><div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.8,marginTop:16}}>{lesson.body}</div><button type="button" className="secondary" disabled={savingProgress!==null} onClick={()=>void toggleProgress(lesson.id,!lesson.completed)}>{savingProgress===lesson.id?'Đang lưu…':lesson.completed?'Đánh dấu chưa hoàn thành':'Đánh dấu đã hoàn thành'}</button></details>)}</div>:<p className="student-empty">{lessons.length?'Không tìm thấy bài học phù hợp.':'Môn học chưa có bài học được xuất bản.'}</p>)}
    {tab==='materials'&&(loadingContent?<p>Đang tải tài liệu…</p>:contentError?<div role="alert"><p>{contentError}</p><button type="button" onClick={()=>setReload(value=>value+1)}>Thử tải lại</button></div>:visibleMaterials.length?<div className="subject-exam-list"><p>{visibleMaterials.length} / {materials.length} tài liệu</p>{visibleMaterials.map(material=><article className="subject-exam-card" key={material.id}><div><h3>{material.title}</h3><p>{material.description}</p></div><a href={material.url} target="_blank" rel="noopener noreferrer">Mở tài liệu</a></article>)}</div>:<p className="student-empty">{materials.length?'Không tìm thấy tài liệu phù hợp.':'Môn học chưa có tài liệu được xuất bản.'}</p>)}
    {(tab==='lessons'||tab==='materials')&&hasMore&&!loadingContent&&!contentError&&<button type="button" className="secondary" onClick={()=>setContentOffset(value=>value+100)}>Tải thêm bài học và tài liệu</button>}
    {tab==='discussion'&&subjectId&&<Discussion key={subjectId} subjectId={subjectId}/>} 
   </div>
 </section>;
}

