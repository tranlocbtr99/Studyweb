import {useEffect,useRef,useState} from 'react';
type User={id:string;email:string;status:string;createdAt:number;roles?:string|null;deletedAt?:number|null};
export default function UserDirectory(){
 const [removed,setRemoved]=useState(false),[pending,setPending]=useState<User|null>(null),[mutating,setMutating]=useState(false);
 const requestId=useRef(0);
 const [users,setUsers]=useState<User[]>([]);
 const [search,setSearch]=useState('');
 const [offset,setOffset]=useState(0);
 const [total,setTotal]=useState(0);
 const [statusFilter,setStatusFilter]=useState<'all'|'active'|'other'>('all');
 const [sortNewest,setSortNewest]=useState(true);
 const [appliedSearch,setAppliedSearch]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 async function load(nextOffset:number,query=appliedSearch,filter=statusFilter,newest=sortNewest,showRemoved=removed){
  const current=++requestId.current;setLoading(true);setError('');
  try{
   const response=await fetch('/api/v1/admin/users?'+new URLSearchParams({search:query,offset:String(nextOffset),status:filter==='other'?'disabled':filter,order:newest?'newest':'oldest',removed:String(showRemoved)}),{credentials:'same-origin'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json() as {users:User[];total:number};
   if(current!==requestId.current)return;
   setUsers(data.users);setOffset(nextOffset);setTotal(data.total);
  }catch(e){if(current!==requestId.current)return;setError('Không thể tải danh sách người dùng: '+String(e));}finally{if(current===requestId.current)setLoading(false);}
 }
 useEffect(()=>{void load(0);},[]);
 async function removeOrRestore(){if(!pending||mutating)return;setMutating(true);setError('');try{const response=await fetch('/api/v1/admin/users/'+pending.id+(removed?'/restore':''),{method:removed?'POST':'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'}});if(!response.ok)throw Error('Không thể xóa/khôi phục tài khoản này. Chỉ tài khoản học viên được phép xóa.');setPending(null);await load(users.length===1?Math.max(0,offset-20):offset)}catch(error){setError((error as Error).message)}finally{setMutating(false)}}
 return <section className="panel user-directory"><div className="toolbar"><div><h1>Quản lý người dùng</h1><p>Danh sách tài khoản thực tế trên hệ thống.</p></div></div>
  <label className="inline-check"><input type="checkbox" checked={removed} disabled={loading||mutating} onChange={event=>{const next=event.target.checked;setRemoved(next);setStatusFilter('all');setPending(null);void load(0,appliedSearch,'all',sortNewest,next)}}/> Học viên đã xóa</label>
  {pending&&<section className="notice" role="group" aria-label="Xác nhận xóa hoặc khôi phục học viên"><strong>{removed?'Khôi phục học viên: ':'Xóa học viên: '}{pending.email}</strong><p>{removed?'Khôi phục quyền truy cập theo trạng thái trước khi xóa.':'Tài khoản sẽ bị chặn đăng nhập và các phiên bị thu hồi. Lịch sử bài làm vẫn được giữ để có thể khôi phục.'}</p><div className="toolbar"><button className={removed?'':'danger'} disabled={mutating} onClick={()=>void removeOrRestore()}>Xác nhận {removed?'khôi phục':'xóa học viên'}</button><button className="secondary" disabled={mutating} onClick={()=>setPending(null)}>Hủy</button></div></section>}
  <form className="toolbar" onSubmit={e=>{e.preventDefault();setAppliedSearch(search);void load(0,search);}}><input aria-label="Tìm email" placeholder="Tìm theo email..." value={search} onChange={e=>setSearch(e.target.value)}/><button disabled={loading}>Tìm kiếm</button><button type="button" className="secondary" disabled={loading} onClick={()=>void load(offset)}>Làm mới</button></form>
  <div className="toolbar"><label>Trạng thái <select value={statusFilter} onChange={e=>{const next=e.target.value as 'all'|'active'|'other';setStatusFilter(next);void load(0,appliedSearch,next);}}><option value="all">Tất cả</option><option value="active">Đang hoạt động</option><option value="other">Không hoạt động</option></select></label><label>Sắp xếp <select value={sortNewest?'new':'old'} onChange={e=>{const next=e.target.value==='new';setSortNewest(next);void load(0,appliedSearch,statusFilter,next);}}><option value="new">Mới nhất trước</option><option value="old">Cũ nhất trước</option></select></label></div>
  <p className="user-directory-count" aria-live="polite">{loading?'Đang tải tài khoản…':'Hiển thị '+users.length+' / '+total+' tài khoản phù hợp'}</p><div className="user-table-wrap"><table className="user-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><span className="user-avatar">{user.email.slice(0,1).toUpperCase()}</span><span>{user.email}</span></td><td><span className="role-badge">{user.roles?.split(',').map(role=>role==='admin'?'Quản trị viên':role==='teacher'?'Giảng viên':role==='student'?'Học viên':role).join(', ')||'Chưa phân vai'}</span></td><td><span className={user.status==='active'?'user-status active':'user-status'}>{removed?'Đã xóa':user.status==='active'?'Hoạt động':'Vô hiệu hóa'}</span></td><td>{new Date(user.createdAt*1000).toLocaleDateString('vi-VN')}</td><td>{user.roles?.split(',').every(role=>role==='student')&&<button className="secondary" disabled={mutating} onClick={()=>setPending(user)}>{removed?'Khôi phục':'Xóa học viên'}</button>}</td></tr>)}</tbody></table></div>
  {users.length===0&&!loading&&<p>Không có người dùng phù hợp trong trang hiện tại.</p>}
  <div className="toolbar"><button type="button" className="secondary" disabled={loading||offset===0} onClick={()=>void load(Math.max(0,offset-20))}>Trang trước</button><span>Trang {Math.floor(offset/20)+1} · {total} tài khoản phù hợp</span><button type="button" className="secondary" disabled={loading||offset+20>=total} onClick={()=>void load(offset+20)}>Trang sau</button></div>
  {error&&<p role="alert">{error}</p>}
 </section>;
}

