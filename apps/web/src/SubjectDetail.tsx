import { useState } from 'react';

type PublishedExam={versionId:string;title:string;subject:string;questionCount:number;durationMinutes:number};
type Props={subject:string;exams:PublishedExam[];onClose:()=>void;onSelectExam:(versionId:string)=>void};
type Tab='exams'|'lessons'|'materials'|'discussion';

export default function SubjectDetail({subject,exams,onClose,onSelectExam}:Props){
 const [tab,setTab]=useState<Tab>('exams');
 const [search,setSearch]=useState('');
 const visibleExams=exams.filter(exam=>exam.title.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
 const tabs:Array<{id:Tab;label:string}>=[{id:'exams',label:'Đề thi'},{id:'lessons',label:'Bài học'},{id:'materials',label:'Tài liệu'},{id:'discussion',label:'Thảo luận'}];
 return <section className="panel subject-detail" aria-label={'Chi tiết môn học '+subject}>
   <div className="subject-detail-hero"><div><span className="subject-detail-eyebrow">LTStudy · Môn học</span><h2>{subject}</h2><p>{exams.length} đề thi đã xuất bản</p></div><button type="button" className="secondary" onClick={onClose}>Đóng</button></div>
   <div className="subject-tabs" role="tablist" aria-label="Nội dung môn học">
     {tabs.map(item=><button key={item.id} type="button" role="tab" id={'subject-tab-'+item.id} aria-selected={tab===item.id} aria-controls="subject-tab-panel" className={tab===item.id?'selected':'secondary'} onClick={()=>setTab(item.id)}>{item.label}</button>)}
   </div>
   <div id="subject-tab-panel" role="tabpanel" aria-labelledby={'subject-tab-'+tab}>
    {tab==='exams'&&<label className="subject-exam-search">Tìm đề thi <input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nhập tên đề thi" /></label>}
    {tab==='exams'&&(visibleExams.length?<div className="subject-exam-list">{visibleExams.map(exam=><article key={exam.versionId} className="subject-exam-card"><div><h3>{exam.title}</h3><p>{exam.questionCount} câu hỏi · {exam.durationMinutes} phút</p></div><button type="button" onClick={()=>onSelectExam(exam.versionId)}>Chọn đề thi</button></article>)}</div>:<p>{search.trim()?'Không tìm thấy đề thi phù hợp.':'Chưa có đề thi được xuất bản cho môn học này.'}</p>)}
    {tab==='lessons'&&<p className="student-empty">Chưa có bài học được cung cấp trên hệ thống. Nội dung sẽ xuất hiện khi chức năng quản lý bài học được triển khai.</p>}
    {tab==='materials'&&<p className="student-empty">Chưa có tài liệu học tập được cung cấp trên hệ thống.</p>}
    {tab==='discussion'&&<p className="student-empty">Chức năng thảo luận chưa được kích hoạt.</p>}
   </div>
 </section>;
}
