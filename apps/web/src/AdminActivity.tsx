import {useEffect,useState} from 'react';
type Analytics={daily:Array<{day:string;count:number}>;statuses:Array<{status:string;count:number}>;activity:Array<{id:string;action:string;createdAt:number;email:string|null}>};
const labels:Record<string,string>={submitted:'Đã nộp',active:'Đang làm',expired:'Hết giờ'};
export default function AdminActivity(){
 const [data,setData]=useState<Analytics|null>(null),[error,setError]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{const abort=new AbortController();setError(false);fetch('/api/v1/admin/analytics',{credentials:'same-origin',signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<Analytics>}).then(setData).catch(()=>{if(!abort.signal.aborted)setError(true)});return()=>abort.abort()},[reload]);
 if(error)return <div role="alert" className="notice">Không tải được thống kê hoạt động. <button className="secondary" onClick={()=>setReload(n=>n+1)}>Thử lại</button></div>;
 if(!data)return <p role="status">Đang tải hoạt động hệ thống…</p>;
 const days=Array.from({length:7},(_,i)=>{const date=new Date(Date.now()-(6-i)*86400000);const key=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);return {day:key,count:data.daily.find(row=>row.day===key)?.count??0}});
 const max=Math.max(1,...days.map(row=>row.count));
 const points=days.map((row,i)=>(24+i*48)+','+(142-row.count/max*105)).join(' ');
 const total=data.statuses.reduce((sum,row)=>sum+row.count,0),submitted=data.statuses.find(row=>row.status==='submitted')?.count??0;
 const percent=total?Math.round(submitted/total*100):0;
 return <div className="analytics-grid">
  <section className="analytics-card"><div className="student-section-title"><h2>Lượt làm bài</h2><span>7 ngày gần nhất</span></div><svg viewBox="0 0 336 170" role="img" aria-label={days.map(row=>row.day+': '+row.count+' lượt').join('; ')}><path d="M24 37H312 M24 89H312 M24 142H312" stroke="#e6edf8" fill="none"/><polygon points={'24,142 '+points+' 312,142'} fill="#eaf3ff"/><polyline points={points} fill="none" stroke="#2479e9" strokeWidth="2.5" strokeLinejoin="round"/>{days.map((row,i)=><g key={row.day}><circle cx={24+i*48} cy={142-row.count/max*105} r="3" fill="#2479e9"/><text x={24+i*48} y="164" textAnchor="middle" fill="#71839e" fontSize="9">{row.day.slice(5).split('-').reverse().join('/')}</text></g>)}</svg><details><summary>Xem số liệu</summary>{days.map(row=><p key={row.day}>{row.day}: {row.count} lượt</p>)}</details></section>
  <section className="analytics-card"><h2>Trạng thái lượt thi</h2><div className="analytics-donut-row"><div className="analytics-donut" style={{background:`conic-gradient(#19be9b ${percent}%,#ddd9ff 0)`}} role="img" aria-label={submitted+' / '+total+' lượt đã nộp'}><div><strong>{percent}%</strong><span>Đã nộp</span></div></div><div>{['submitted','active','expired'].map(status=><p className={'analytics-legend legend-'+status} key={status}><span/>{labels[status]} <strong>{data.statuses.find(row=>row.status===status)?.count??0}</strong></p>)}</div></div>{total===0&&<p>Chưa có lượt thi.</p>}</section>
  <section className="analytics-card analytics-recent"><h2>Hoạt động quản trị gần đây</h2>{data.activity.length?data.activity.map(row=><article key={row.id}><span className="user-avatar">{(row.email??'HT').slice(0,1).toUpperCase()}</span><div><strong>{row.email??'Hệ thống'}</strong><p>{row.action}</p></div><time dateTime={new Date(row.createdAt*1000).toISOString()}>{new Date(row.createdAt*1000).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</time></article>):<p>Chưa có hoạt động được ghi nhận.</p>}</section>
 </div>;
}
