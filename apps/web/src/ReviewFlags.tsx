import {useEffect,useState} from 'react';

type Props={attemptId:string;positions:number[];currentPosition:number;onNavigate:(position:number)=>void};

export default function ReviewFlags({attemptId,positions,currentPosition,onNavigate}:Props){
  const storageKey='studyweb_review_flags_'+attemptId;
  const [flags,setFlags]=useState<number[]>([]);
  useEffect(()=>{
    try{
      const stored=JSON.parse(sessionStorage.getItem(storageKey)??'[]') as unknown;
      setFlags(Array.isArray(stored)?stored.filter((value):value is number=>typeof value==='number'&&positions.includes(value)):[]);
    }catch{setFlags([]);}
  },[storageKey,positions.join(',')]);
  function toggle(){
    const next=flags.includes(currentPosition)?flags.filter(position=>position!==currentPosition):[...flags,currentPosition];
    setFlags(next);
    sessionStorage.setItem(storageKey,JSON.stringify(next));
  }
  return <aside className="review-flags" aria-label="Câu hỏi cần xem lại">
    <div className="toolbar"><strong>Cần xem lại: {flags.length} câu</strong>
      <button type="button" className="secondary" aria-pressed={flags.includes(currentPosition)} onClick={toggle}>
        {flags.includes(currentPosition)?'Bỏ đánh dấu':'Đánh dấu câu này'}
      </button>
    </div>
    {flags.length>0&&<nav className="question-navigation" aria-label="Đi đến câu đã đánh dấu">
      {positions.filter(position=>flags.includes(position)).map(position=>
        <button type="button" className={position===currentPosition?'question-current':'secondary'} key={position} onClick={()=>onNavigate(position)}>⚑ {position+1}</button>)}
    </nav>}
  </aside>;
}
