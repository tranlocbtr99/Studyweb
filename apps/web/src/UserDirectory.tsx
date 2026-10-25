import {useEffect,useState} from 'react';
type User={id:string;email:string;status:string;createdAt:number};
export default function UserDirectory(){
 const [users,setUsers]=useState<User[]>([]);
 const [search,setSearch]=useState('');
 const [offset,setOffset]=useState(0);
 const [total,setTotal]=useState(0);
 const [statusFilter,setStatusFilter]=useState<'all'|'active'|'other'>('all');
 const [sortNewest,setSortNewest]=useState(true);
 const [appliedSearch,setAppliedSearch]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 async function load(nextOffset:number,query=appliedSearch,filter=statusFilter,newest=sortNewest){
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/v1/admin/users?'+new URLSearchParams({search:query,offset:String(nextOffset),status:filter==='other'?'disabled':filter,order:newest?'newest':'oldest'}),{credentials:'same-origin'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json() as {users:User[];total:number};
   setUsers(data.users);setOffset(nextOffset);setTotal(data.total);
  }catch(e){setError('Không thể tải danh sách người dùng: '+String(e));}finally{setLoading(false);}
 }
 useEffect(()=>{void load(0);},[]);
 return <section className="panel user-directory"><div className="toolbar"><div><h1>Quản lý người dùng</h1><p>Danh sách tài khoản thực tế trên hệ thống.</p></div></div>
  <form className="toolbar" onSubmit={e=>{e.preventDefault();setAppliedSearch(search);void load(0,search);}}><input aria-label="Tìm email" placeholder="Tìm theo email..." value={search} onChange={e=>setSearch(e.target.value)}/><button disabled={loading}>Tìm kiếm</button></form>
  <div className="toolbar"><label>Trạng thái <select value={statusFilter} onChange={e=>{const next=e.target.value as 'all'|'active'|'other';setStatusFilter(next);void load(0,appliedSearch,next);}}><option value="all">Tất cả</option><option value="active">Đang hoạt động</option><option value="other">Không hoạt động</option></select></label><label>Sắp xếp <select value={sortNewest?'new':'old'} onChange={e=>{const next=e.target.value==='new';setSortNewest(next);void load(0,appliedSearch,statusFilter,next);}}><option value="new">Mới nhất trước</option><option value="old">Cũ nhất trước</option></select></label></div>
  <div className="user-table-wrap"><table className="user-table"><thead><tr><th>Người dùng</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><span className="user-avatar">{user.email.slice(0,1).toUpperCase()}</span><span>{user.email}</span></td><td><span className={user.status==='active'?'user-status active':'user-status'}>{user.status==='active'?'Hoạt động':'Vô hiệu hóa'}</span></td><td>{new Date(user.createdAt*1000).toLocaleDateString('vi-VN')}</td></tr>)}</tbody></table></div>
  {users.length===0&&!loading&&<p>Không có người dùng phù hợp trong trang hiện tại.</p>}
  <div className="toolbar"><button type="button" className="secondary" disabled={loading||offset===0} onClick={()=>void load(Math.max(0,offset-20))}>Trang trước</button><span>Trang {Math.floor(offset/20)+1} · {total} tài khoản phù hợp</span><button type="button" className="secondary" disabled={loading||offset+20>=total} onClick={()=>void load(offset+20)}>Trang sau</button></div>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
