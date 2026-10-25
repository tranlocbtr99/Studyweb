import { useEffect, useState } from 'react';
type Created = { id: string };
type Subject = Created & {slug:string;title:string};
type Topic = Created & {subjectId:string;title:string};
const labels = ['A','B','C','D'] as const;
async function create<T>(path: string, body: object): Promise<T> {
  const response = await fetch('/api/v1/admin/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result = await response.json() as T & {error?:{code:string}};
  if (!response.ok) throw new Error(result.error?.code ?? 'HTTP '+response.status);
  return result;
}
export default function AdminPanel(){
  const [subject,setSubject]=useState<Created|null>(null);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [topics,setTopics]=useState<Topic[]>([]);
  const [topic,setTopic]=useState<Created|null>(null);
  const [exam,setExam]=useState<Created|null>(null);
  const [version,setVersion]=useState<Created|null>(null);
  const [subjectTitle,setSubjectTitle]=useState('');
  const [slug,setSlug]=useState('');
  const [topicTitle,setTopicTitle]=useState('');
  const [examTitle,setExamTitle]=useState('');
  const [durationMinutes,setDurationMinutes]=useState(90);
  const [body,setBody]=useState('');
  const [options,setOptions]=useState(['','','','']);
  const [correctOption,setCorrectOption]=useState<'A'|'B'|'C'|'D'>('A');
  const [explanation,setExplanation]=useState('');
  const [count,setCount]=useState(0);
  const [draftItems,setDraftItems]=useState<Array<{id:string;position:number;body:string;options:Array<{label:string;text:string}>}>>([]);
  const [createdQuestions,setCreatedQuestions]=useState<Array<{id:string;body:string}>>([]);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [bank,setBank]=useState<Array<{id:string;body:string;topicId:string;subjectId:string;status:string;options:Array<{label:string;text:string}>;correctOption:string;explanation:string}>>([]);
  const [editing,setEditing]=useState<string|null>(null);
  const [editBody,setEditBody]=useState('');
  const [editOptions,setEditOptions]=useState(['','','','']);
  const [editCorrect,setEditCorrect]=useState<'A'|'B'|'C'|'D'>('A');
  const [editExplanation,setEditExplanation]=useState('');
  const [search,setSearch]=useState('');
  const [offset,setOffset]=useState(0);
  const [savedExams,setSavedExams]=useState<Array<{id:string;subjectId:string;title:string;versionId:string|null;versionNumber:number|null;status:string|null;questionCount:number;durationMinutes:number}>>([]);
  useEffect(()=>{
    let alive=true;
    fetch('/api/v1/admin/subjects',{credentials:'same-origin'}).then(async response=>{
      if(!response.ok)throw Error('HTTP '+response.status);
      return response.json() as Promise<{subjects:Subject[]}>;
    }).then(result=>{if(alive)setSubjects(result.subjects);}).catch(()=>{if(alive)setMessage('Không tải được danh sách môn học');});
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!subject){setTopics([]);return;}
    let alive=true;
    fetch('/api/v1/admin/topics?'+new URLSearchParams({subjectId:subject.id}),{credentials:'same-origin'}).then(async response=>{
      if(!response.ok)throw Error('HTTP '+response.status);
      return response.json() as Promise<{topics:Topic[]}>;
    }).then(result=>{if(alive)setTopics(result.topics);}).catch(()=>{if(alive)setMessage('Không tải được danh sách chủ đề');});
    return ()=>{alive=false;};
  },[subject?.id]);
  async function action(fn:()=>Promise<void>){
    setBusy(true);setMessage('');
    try{await fn();}catch(error){setMessage('Thao tác thất bại: '+String(error));}finally{setBusy(false);}
  }
  async function loadDraftItems(versionId:string){
    const response=await fetch('/api/v1/admin/exam-versions/'+versionId+'/items',{credentials:'same-origin'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json() as {items:typeof draftItems};
    setDraftItems(data.items);setCount(data.items.length);
  }
  async function loadExams(){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/v1/admin/exams',{credentials:'same-origin'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json() as {exams:Array<{id:string;subjectId:string;title:string;versionId:string|null;versionNumber:number|null;status:string|null;questionCount:number;durationMinutes:number}>};
      setSavedExams(data.exams);
    }catch(error){setMessage('Không tải được danh sách đề thi: '+String(error));}finally{setBusy(false);}
  }
  async function loadBank(nextOffset=0){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/v1/admin/questions?'+new URLSearchParams({search,offset:String(nextOffset),limit:'30'}),{credentials:'same-origin'});
      const result=await response.json() as {questions?:typeof bank;error?:{code:string}};
      if(!response.ok)throw new Error(result.error?.code??'HTTP '+response.status);
      setBank(result.questions??[]);setOffset(nextOffset);
    }catch(error){setMessage('Không tải được ngân hàng câu hỏi: '+String(error));}finally{setBusy(false);}
  }
  return <section className="panel admin-editor">
    <h1>Quản trị · Biên soạn đề thi</h1>
    <p>Tạo môn học, chủ đề, câu hỏi trắc nghiệm rồi xuất bản đề để học viên làm bài. Các bước được lưu trực tiếp lên máy chủ.</p>
    <div className="admin-step"><h2>Tiếp tục từ môn học đã lưu</h2><label>Chọn môn học<select value={subject?.id??''} onChange={e=>{const id=e.target.value;setSubject(id?{id}:null);setTopic(null);setExam(null);setVersion(null);setCreatedQuestions([]);}}><option value="">Chọn môn học</option>{subjects.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>
    <form onSubmit={event=>{event.preventDefault();void action(async()=>{
      const data=await create<{subject:Created}>('subjects',{slug,title:subjectTitle});
      setSubjects(prev=>[...prev,{...data.subject,slug,title:subjectTitle}]);setSubject(data.subject);setTopic(null);setExam(null);setVersion(null);setCount(0);setMessage('Đã tạo môn học');
    });}}>
      <h2>1. Tạo môn học</h2>
      <label>Tên môn học<input required minLength={2} maxLength={160} value={subjectTitle} onChange={e=>setSubjectTitle(e.target.value)}/></label>
      <label>Mã môn (chữ thường, số, dấu gạch ngang)<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={64} value={slug} onChange={e=>setSlug(e.target.value)}/></label>
      <button disabled={busy}>Lưu môn học</button>
    </form>
    {subject&&<div className="admin-step"><h2>Chủ đề đã lưu</h2><label>Chọn chủ đề<select value={topic?.id??''} onChange={e=>setTopic(e.target.value?{id:e.target.value}:null)}><option value="">Chọn chủ đề</option>{topics.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>}
    {subject&&<form onSubmit={event=>{event.preventDefault();void action(async()=>{
      const data=await create<{topic:Created}>('topics',{subjectId:subject.id,title:topicTitle});
      setTopics(prev=>[...prev,{...data.topic,subjectId:subject.id,title:topicTitle}]);setTopic(data.topic);setMessage('Đã tạo chủ đề');
    });}}>
      <h2>2. Tạo chủ đề câu hỏi</h2>
      <label>Tên chủ đề<input required minLength={2} maxLength={160} value={topicTitle} onChange={e=>setTopicTitle(e.target.value)}/></label>
      <button disabled={busy}>Lưu chủ đề</button>
    </form>}
    {topic&&<form onSubmit={event=>{event.preventDefault();void action(async()=>{
      const data=await create<{question:Created}>('questions',{topicId:topic.id,body,options,correctOption,explanation});
      setCreatedQuestions(prev=>[...prev,{id:data.question.id,body}]);
      setBody('');setOptions(['','','','']);setExplanation('');setMessage('Đã lưu câu hỏi vào ngân hàng câu hỏi');
    });}}>
      <h2>3. Tạo câu hỏi trắc nghiệm</h2>
      <label>Nội dung câu hỏi<textarea required minLength={5} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label>
      {labels.map((label,index)=><label key={label}>Đáp án {label}<input required maxLength={1000} value={options[index]} onChange={e=>setOptions(prev=>prev.map((item,i)=>i===index?e.target.value:item))}/></label>)}
      <label>Đáp án đúng<select value={correctOption} onChange={e=>setCorrectOption(e.target.value as typeof correctOption)}>{labels.map(label=><option key={label} value={label}>{label}</option>)}</select></label>
      <label>Giải thích<textarea maxLength={4000} value={explanation} onChange={e=>setExplanation(e.target.value)}/></label>
      <button disabled={busy}>Lưu câu hỏi</button>
    </form>}
    <div className="admin-step">
      <h2>Đề thi và bản nháp đã lưu</h2>
      <p>Mở lại phiên bản nháp để tiếp tục thêm câu hỏi. Đề đã xuất bản chỉ hiển thị để tham khảo.</p>
      <button className="secondary" disabled={busy} onClick={()=>void loadExams()}>Tải danh sách đề thi</button>
      {savedExams.map(item=><div key={item.id+':'+(item.versionId??'')} className="bank-question">
        <strong>{item.title}</strong>
        <small>{item.versionId?'Phiên bản '+item.versionNumber+' · '+item.status+' · '+item.questionCount+' câu':'Chưa có phiên bản'}</small>
        {item.status==='draft'&&item.versionId&&<button className="secondary" disabled={busy} onClick={()=>{
          setSubject({id:item.subjectId});setTopic(null);setExam({id:item.id});setVersion({id:item.versionId!});setCount(item.questionCount);setDurationMinutes(item.durationMinutes);setDraftItems([]);void loadDraftItems(item.versionId!).catch(()=>setMessage('Không tải được danh sách câu hỏi trong đề'));setMessage('Đã mở bản nháp: '+item.title);
        }}>Tiếp tục biên soạn</button>}
      </div>)}
    </div>
    {subject&&<form onSubmit={event=>{event.preventDefault();void action(async()=>{
      const data=await create<{exam:Created}>('exams',{subjectId:subject.id,title:examTitle});
      setExam(data.exam);setVersion(null);setCount(0);setMessage('Đã tạo đề thi');
    });}}>
      <h2>4. Tạo đề thi</h2>
      <label>Tên đề thi<input required minLength={3} maxLength={160} value={examTitle} onChange={e=>setExamTitle(e.target.value)}/></label>
      <button disabled={busy}>Tạo đề</button>
    </form>}
    {exam&&<div className="admin-step">
      <h2>5. Tạo phiên bản đề</h2>
      <label>Thời gian làm bài (5–240 phút)<input type="number" min={5} max={240} value={durationMinutes} onChange={e=>setDurationMinutes(Number(e.target.value))}/></label>
      <button disabled={busy} onClick={()=>void action(async()=>{
        const data=await create<{version:Created}>('exam-versions',{examId:exam.id,durationMinutes});
        setVersion(data.version);setCount(0);setDraftItems([]);setMessage('Đã tạo phiên bản nháp');
      })}>Tạo phiên bản nháp</button>
    </div>}
    <div className="admin-step">
      <h2>Ngân hàng câu hỏi đã lưu</h2>
      <p>Tìm kiếm câu hỏi đã lưu trên máy chủ, kể cả từ các phiên làm việc trước.</p>
      <form onSubmit={e=>{e.preventDefault();void loadBank(0);}}>
        <label>Tìm nội dung câu hỏi<input value={search} maxLength={120} onChange={e=>setSearch(e.target.value)} placeholder="Nhập từ khóa"/></label>
        <button disabled={busy}>Tìm câu hỏi</button>
      </form>
      {bank.map(q=><div key={q.id} className="bank-question"><strong>{q.body}</strong><small>{q.id}</small>
        {q.status==='draft'&&<button type="button" className="secondary" disabled={busy} onClick={()=>{
          setEditing(q.id);setEditBody(q.body);setEditOptions(labels.map(label=>q.options.find(option=>option.label===label)?.text??''));setEditCorrect(q.correctOption as typeof editCorrect);setEditExplanation(q.explanation);
        }}>Chỉnh sửa</button>}
        {editing===q.id&&<form onSubmit={e=>{e.preventDefault();void action(async()=>{
          const response=await fetch('/api/v1/admin/questions/'+q.id,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:editBody,options:editOptions,correctOption:editCorrect,explanation:editExplanation})});
          if(!response.ok)throw Error('HTTP '+response.status);
          setBank(prev=>prev.map(item=>item.id===q.id?{...item,body:editBody,options:labels.map((label,i)=>({label,text:editOptions[i]})),correctOption:editCorrect,explanation:editExplanation}:item));
          setEditing(null);setMessage('Đã cập nhật câu hỏi. Nội dung đề thi đã xuất bản không thay đổi.');
        });}}>
          <label>Nội dung<textarea required minLength={5} maxLength={4000} value={editBody} onChange={e=>setEditBody(e.target.value)}/></label>
          {labels.map((label,i)=><label key={label}>Đáp án {label}<input required maxLength={1000} value={editOptions[i]} onChange={e=>setEditOptions(prev=>prev.map((v,j)=>j===i?e.target.value:v))}/></label>)}
          <label>Đáp án đúng<select value={editCorrect} onChange={e=>setEditCorrect(e.target.value as typeof editCorrect)}>{labels.map(label=><option key={label}>{label}</option>)}</select></label>
          <label>Giải thích<textarea maxLength={4000} value={editExplanation} onChange={e=>setEditExplanation(e.target.value)}/></label>
          <div className="toolbar"><button disabled={busy}>Lưu chỉnh sửa</button><button type="button" className="secondary" onClick={()=>setEditing(null)}>Hủy</button></div>
        </form>}
      </div>)}
      <div className="toolbar"><button className="secondary" disabled={busy||offset===0} onClick={()=>void loadBank(Math.max(0,offset-30))}>Trang trước</button><button className="secondary" disabled={busy||bank.length<30} onClick={()=>void loadBank(offset+30)}>Trang tiếp</button></div>
    </div>
    {version&&<div className="admin-step">
      <h2>6. Thêm câu hỏi vào đề</h2>
      <label>Thời gian làm bài (phút)<input type="number" min={5} max={240} value={durationMinutes} onChange={e=>setDurationMinutes(Number(e.target.value))}/></label>
      <button type="button" className="secondary" disabled={busy||durationMinutes<5||durationMinutes>240} onClick={()=>void action(async()=>{const response=await fetch('/api/v1/admin/exam-versions/'+version.id+'/duration',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({durationMinutes})});if(!response.ok)throw Error('HTTP '+response.status);setMessage('Đã lưu thời gian làm bài');})}>Lưu thời gian làm bài</button>
      <button className="secondary" disabled={busy} onClick={()=>void loadDraftItems(version.id).catch(()=>setMessage('Không tải được nội dung đề'))}>Làm mới danh sách câu hỏi</button>
      {draftItems.map(item=><div className="bank-question" key={item.id}>
        <strong>Câu {item.position+1}. {item.body}</strong>
        <small>{item.options.map(option=>option.label+'. '+option.text).join(' · ')}</small>
        <div className="toolbar">
          {(['up','down'] as const).map(direction=><button type="button" key={direction} className="secondary" disabled={busy||(direction==='up'?item.position===0:item.position===draftItems.length-1)} onClick={()=>void action(async()=>{
            const response=await fetch('/api/v1/admin/exam-items/'+item.id+'/move',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({versionId:version.id,direction})});
            if(!response.ok)throw Error('HTTP '+response.status);
            await loadDraftItems(version.id);setMessage('Đã thay đổi thứ tự câu hỏi');
          })}>{direction==='up'?'Chuyển lên':'Chuyển xuống'}</button>)}
          <button type="button" className="secondary" disabled={busy} onClick={()=>{if(!window.confirm('Loại câu hỏi này khỏi đề nháp?'))return;void action(async()=>{
            const response=await fetch('/api/v1/admin/exam-items/'+item.id+'?'+new URLSearchParams({versionId:version.id}),{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'}});
            if(!response.ok)throw Error('HTTP '+response.status);
            await loadDraftItems(version.id);setMessage('Đã loại câu hỏi khỏi đề nháp');
          });}}>Loại khỏi đề</button>
        </div>
      </div>)}
      <p>Chọn câu hỏi đã tạo để thêm vào phiên bản đề thi.</p>
      <QuestionPicker busy={busy} position={count} questions={[...createdQuestions,...bank.filter(q=>!createdQuestions.some(item=>item.id===q.id)&&(!subject||q.subjectId===subject.id))]} onAdd={id=>action(async()=>{
        await create('exam-items',{versionId:version.id,questionId:id,position:count});
        setCount(prev=>prev+1);void loadDraftItems(version.id).catch(()=>setMessage('Đã thêm câu hỏi nhưng chưa tải lại danh sách'));setMessage('Đã thêm câu hỏi vào đề');
      })}/>
      <p>Đã thêm {count} câu hỏi trong phiên làm việc này.</p>
      <button disabled={busy||count===0} onClick={()=>void action(async()=>{
        if(!window.confirm('Xuất bản đề? Phiên bản đã xuất bản không thể chỉnh sửa.'))return;
        await create('publish-exam-version',{versionId:version.id});
        setMessage('Đã xuất bản đề thi. Mã phiên bản: '+version.id);
        setVersion(null);
      })}>Xuất bản đề thi</button>
    </div>}
    {message&&<p role="status" className="notice">{message}</p>}
  </section>;
}
function QuestionPicker({busy,position,questions,onAdd}:{busy:boolean;position:number;questions:Array<{id:string;body:string}>;onAdd:(id:string)=>void}){
  const [id,setId]=useState('');
  return <form onSubmit={e=>{e.preventDefault();onAdd(id);setId('');}}>
    <label>Câu hỏi<select required value={id} onChange={e=>setId(e.target.value)}><option value="">Chọn câu hỏi</option>{questions.map(q=><option key={q.id} value={q.id}>{q.body.slice(0,90)}</option>)}</select></label>
    <button disabled={busy}>Thêm câu {position+1}</button>
  </form>;
}
