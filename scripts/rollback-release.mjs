import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const saved=JSON.parse(readFileSync('before-worker.json','utf8'));
const deployments=Array.isArray(saved)?saved:(saved.deployments??saved.result);
if(!Array.isArray(deployments))throw Error('Unrecognized previous deployment metadata; stopping automatic rollback');
const latest=deployments.slice().sort((a,b)=>String(b.created_on??'').localeCompare(String(a.created_on??'')))[0];
const versions=latest?.versions;if(!Array.isArray(versions)||versions.length!==1||Number(versions[0].percentage)!==100)throw Error('Previous deployment was not a single full version; stopping automatic rollback');
const id=versions[0].version_id;if(!/^[a-f0-9-]{36}$/.test(id??''))throw Error('Invalid previous Worker version');
const result=spawnSync('npx',['wrangler','rollback',id,'--yes','--message','Rollback failed LTStudy release verification'],{cwd:'apps/api',stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});process.exit(result.status??1);
