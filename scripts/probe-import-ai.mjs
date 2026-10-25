// Bounded synthetic test on a temporary Worker. It has no database bindings.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {resolve} from 'node:path';import {spawnSync} from 'node:child_process';import {randomBytes} from 'node:crypto';
const root=process.cwd(),api=resolve(root,'apps/api'),directory=mkdtempSync(resolve(tmpdir(),'ltstudy-ai-probe-')),token=randomBytes(32).toString('hex'),name='ltstudy-ai-probe-'+randomBytes(8).toString('hex');
console.log('::add-mask::'+token);
function run(args,options={}){return spawnSync('npx',args,{cwd:api,encoding:'utf8',maxBuffer:4*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false'},...options})}
async function cloudflare(path,method='GET'){const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+path,{method,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});const data=await response.json();if(!response.ok||!data.success)throw Error('Temporary probe management failed: HTTP '+response.status);return data.result}
// Recover only the no-database probe created by this task's first failed run.
const stale=await cloudflare('/workers/scripts');for(const worker of stale){if(!/^ltstudy-ai-probe-[a-f0-9]{16}$/.test(worker.id)||worker.modified_on<'2026-10-25T16:03:16'||worker.modified_on>'2026-10-25T16:03:23')continue;const settings=await cloudflare('/workers/scripts/'+worker.id+'/settings');const bindings=settings.bindings??[];if(!bindings.some(b=>b.name==='PROBE_TOKEN'&&b.type==='plain_text')||bindings.some(b=>!['ai','plain_text'].includes(b.type)))throw Error('Unexpected stale probe bindings; refusing cleanup');await cloudflare('/workers/scripts/'+worker.id,'DELETE');console.log('Removed this task’s abandoned temporary probe: '+worker.id)}
let attempted=false;console.log('Temporary AI probe: '+name);
try{
 const entry=resolve(directory,'entry.ts'),bundle=resolve(directory,'worker.mjs'),config=resolve(directory,'wrangler.json');
 writeFileSync(entry,`import {analyzeExamText} from ${JSON.stringify(resolve(api,'src/imports.ts'))};
 export default {async fetch(req,env){if(req.headers.get('X-LTStudy-Probe')!==env.PROBE_TOKEN)return new Response('Not found',{status:404});
 const text=${JSON.stringify('Câu 1: Which number is equal to one plus one?\nA. Two\nB. Three\nC. Four\nD. Five\nĐáp án: A')};
 const result=await analyzeExamText(env.AI,text);if(result.questions.length!==1||result.questions[0].correctOption!=='A')return Response.json({ok:false},{status:502});
 const conversion=await env.AI.toMarkdown({name:'synthetic-exam.html',blob:new Blob(['<h1>Question</h1><p>Testing document conversion only.</p>'],{type:'text/html'})});
 const item=Array.isArray(conversion)?conversion[0]:conversion;
 return Response.json({ok:true,questions:result.questions.length,conversion:typeof item?.data==='string'&&item.data.includes('Testing')});}};`);
 const build=run(['esbuild',entry,'--bundle','--platform=browser','--format=esm','--outfile='+bundle]);if(build.status!==0)throw Error('AI probe bundle failed');
 writeFileSync(config,JSON.stringify({name,main:bundle,compatibility_date:'2026-10-01',workers_dev:true,ai:{binding:'AI'},vars:{PROBE_TOKEN:token}}));
 attempted=true;const deployment=run(['wrangler','deploy','--config',config]);if(deployment.status!==0){console.log(deployment.stderr.replaceAll(token,'[MASKED]').slice(-3000));throw Error('AI binding probe deployment failed')}
 const urls=[...deployment.stdout.matchAll(/https:\/\/[a-z0-9.-]+\.workers\.dev\/?/gi)];const url=urls.at(-1)?.[0];if(!url)throw Error('Cannot identify temporary probe URL');
 console.log('Probe URL: '+url);let response;for(let attempt=0;attempt<8;attempt++){response=await fetch(url,{headers:{'X-LTStudy-Probe':token},redirect:'error',signal:AbortSignal.timeout(120000)});if(response.status!==404)break;await new Promise(resolve=>setTimeout(resolve,5000))}if(!response.ok)throw Error('AI extraction probe returned HTTP '+response.status+': '+(await response.text()).replaceAll(token,'[MASKED]').slice(0,160));const data=await response.json();if(!data.ok||!data.conversion)throw Error('AI extraction/conversion probe failed');console.log('Actual Workers AI extraction and document conversion verified with synthetic content.');
}finally{if(attempted){await cloudflare('/workers/scripts/'+name,'DELETE');console.log('Temporary AI probe removed.')}rmSync(directory,{recursive:true,force:true})}
