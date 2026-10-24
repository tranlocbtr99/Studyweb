import { useState } from 'react';
type Created = { id: string };
const labels = ['A','B','C','D'] as const;
async function create<T>(path: string, body: object): Promise<T> {
  const response = await fetch('/api/v1/admin/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result = await response.json() as T & {error?:{code:string}};
  if (!response.ok) throw new Error(result.error?.code ?? 'HTTP '+response.status);
  return result;
}
export default function AdminPanel(){
  const [subject,setSubject]=useState<Created|null>(null);
  const [topic,setTopic]=useState<Created|null>(null);
  const [exam,setExam]=useState<Created|null>(null);
  const [version,setVersion]=useState<Created|null>(null);
  const [subjectTitle,setSubjectTitle]=useState('');
  const [slug,setSlug]=useState('');
  const [topicTitle,setTopicTitle]=useState('');
  const [examTitle,setExamTitle]=useState('');
  const [body,setBody]=useState('');
  const [options,setOptions]=useState(['','','','']);
  const [correctOption,setCorrectOption]=useState<'A'|'B'|'C'|'D'>('A');
  const [explanation,setExplanation]=useState('');
  const [count,setCount]=useState(0);
  const [createdQuestions,setCreatedQuestions]=useState<Array<{id:string;body:string}>>([]);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function action(fn:()=>Promise<void>){
    setBusy(true);setMessage('');
    try{await fn();}catch(error){setMessage('Thao tác thất bại: '+String(error));}finally{setBusy(false);}
  }
  return <section className="panel admin-editor">
    <h1>Quản trị · Biên soạn đề thi</h1>
    <p>Tạo môn học, chủ đề, câu hỏi trắc nghiệm rồi xuất bản đề để học viên làm bài. Các bước được lưu trực tiếp lên máy chủ.</p>
    <form onSubmit={event=>{event.preventDefault();void action(async()=>{
      const data=await create<{subject:Created}>('subjects',{slug,title:subjectTitle});
      setSubject(data.subject);setTopic(null);setExam(null);setVersion(null);setCount(0);setMessage('Đã tạo môn học');
    });}}>
      <h2>1. Tạo môn học</h2>
      <label>Tên môn học<input required minLength={2} maxLength={160} value={subjectTitle} onChange={e=>setSubjectTitle(e.target.value)}/></label>
      <label>Mã môn (chữ thường, số, dấu gạch ngang)<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={64} value={slug} onChange={e=>setSlug(e.target.value)}/></label>
      <button disabled={busy}>Lưu môn học</button>
    </form>
    {subject&&<form onSubmit={event=>{event.preventDefault();void action(async()=>{
      const data=await create<{topic:Created}>('topics',{subjectId:subject.id,title:topicTitle});
      setTopic(data.topic);setMessage('Đã tạo chủ đề');
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
      <button disabled={busy} onClick={()=>void action(async()=>{
        const data=await create<{version:Created}>('exam-versions',{examId:exam.id});
        setVersion(data.version);setCount(0);setMessage('Đã tạo phiên bản nháp');
      })}>Tạo phiên bản nháp</button>
    </div>}
    {version&&<div className="admin-step">
      <h2>6. Thêm câu hỏi vào đề</h2>
      <p>Chọn câu hỏi đã tạo để thêm vào phiên bản đề thi.</p>
      <QuestionPicker busy={busy} position={count} questions={createdQuestions} onAdd={id=>action(async()=>{
        await create('exam-items',{versionId:version.id,questionId:id,position:count});
        setCount(prev=>prev+1);setMessage('Đã thêm câu hỏi vào đề');
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
