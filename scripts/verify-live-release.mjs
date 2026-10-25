import {randomBytes} from 'node:crypto';
import {wranglerAdapter} from './migrate-release.mjs';
const url=new URL(process.env.STUDYWEB_RELEASE_URL??'https://studyweb-api.tranlocbtr99.workers.dev');
const sha=process.env.GITHUB_SHA;
if(url.protocol!=='https:'||url.hostname!=='studyweb-api.tranlocbtr99.workers.dev'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('Unexpected release origin');
if(!/^[a-f0-9]{40}$/.test(sha??''))throw Error('Missing release SHA');
const origin=url.origin;
async function call(path,expected,init={}){const response=await fetch(origin+path,{...init,redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache',...init.headers}});if(response.status!==expected)throw Error(path+' returned '+response.status+', expected '+expected);return response}
const health=await (await call('/api/v1/health',200)).json();if(health.status!=='ok'||health.release!==sha)throw Error('Worker release fingerprint mismatch');
const html=await (await call('/',200)).text();if(!html.includes('name="ltstudy-release" content="'+sha+'"'))throw Error('Static frontend fingerprint mismatch');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.(?:js|css))"/g)].map(match=>match[1]);if(assets.length<2)throw Error('Missing built frontend assets');for(const asset of assets)await call(asset,200);
for(const path of ['/api/v1/student/subjects','/api/v1/community/announcements','/api/v1/admin/status','/api/v1/admin/results'])await call(path,401);
const email='release-'+sha.slice(0,12)+'-'+randomBytes(4).toString('hex')+'@example.invalid',password=randomBytes(32).toString('hex');
const db=wranglerAdapter();let registered=false,cookie='';
try{
 await call('/api/v1/auth/register',201,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});registered=true;
 const login=await call('/api/v1/auth/login',200,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 const raw=login.headers.get('set-cookie')??'';cookie=raw.match(/studyweb_session=[a-f0-9]{64}/)?.[0]??'';if(!cookie)throw Error('Login did not issue a secure session');if(!/httponly/i.test(raw)||!/secure/i.test(raw))throw Error('Session cookie protection missing');
 const me=await (await call('/api/v1/me',200,{headers:{Cookie:cookie}})).json();if(!Array.isArray(me.user?.roles)||me.user.roles.includes('admin')||!me.user.roles.includes('student'))throw Error('Registration role isolation failed');
 for(const path of ['/api/v1/student/subjects','/api/v1/student/exam-catalog','/api/v1/student/attempts','/api/v1/community/announcements'])await call(path,200,{headers:{Cookie:cookie}});
 for(const path of ['/api/v1/admin/status','/api/v1/admin/results','/api/v1/community/admin/announcements'])await call(path,403,{headers:{Cookie:cookie}});
 await call('/api/v1/auth/logout',403,{method:'POST',headers:{Cookie:cookie,Origin:'https://untrusted.example'}});
 await call('/api/v1/auth/logout',200,{method:'POST',headers:{Cookie:cookie,Origin:origin}});
 await call('/api/v1/me',401,{headers:{Cookie:cookie}});
 console.log('Live release verified: exact frontend/API version, assets, registration, login, student reads, admin isolation, CSRF and logout');
}finally{
 if(registered){
  // Only the unique synthetic student created by this run can match this predicate.
  const rows=await db.query('exam_core',"SELECT id FROM users WHERE email='"+email+"'");
  const id=rows[0]?.id;if(!/^[a-f0-9-]{36}$/.test(id??''))throw Error('Cannot identify the release test student for cleanup');
  await db.execute('exam_core',"UPDATE users SET status='disabled' WHERE id='"+id+"' AND email='"+email+"' AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=users.id AND r.code='admin'); UPDATE sessions SET revoked_at=unixepoch() WHERE user_id='"+id+"' AND revoked_at IS NULL;");
  const check=await db.query('exam_core',"SELECT status FROM users WHERE id='"+id+"' AND email='"+email+"'");if(check[0]?.status!=='disabled')throw Error('Release test account cleanup failed');
  console.log('Synthetic test student disabled and sessions revoked; existing accounts and exam records unchanged');
 }
}
