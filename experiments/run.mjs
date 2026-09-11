import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import pg from 'pg';
import {Wallet,JsonRpcProvider,Contract,ContractFactory,keccak256,toUtf8Bytes} from 'ethers';
import {compile} from '../scripts/compile.mjs';

const apiUrl=process.env.API_URL||'http://localhost:8080',rpc=process.env.RPC_URL||'http://localhost:8545';
const provider=new JsonRpcProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=300;
if(Number((await provider.getNetwork()).chainId)!==26125)throw Error('Only the local chain 26125 is supported');
const accounts=JSON.parse(fs.readFileSync('generated/accounts.json')),wallets=accounts.map(a=>new Wallet(a.privateKey,provider));
const deployment=JSON.parse(fs.readFileSync('generated/deployment.json'));const artifacts=compile();
const appPlatform=new Contract(deployment.platform,artifacts.AssetPlatform.abi,wallets[0]);
const tests=[],raw=[];const runId=crypto.randomUUID();
const report={title:'Security and state-transition validation',runId,environment:{timestamp:new Date().toISOString(),node:process.version,platform:os.platform(),cpu:os.cpus()[0]?.model,memoryGiB:Math.round(os.totalmem()/2**30),chainId:26125,rpcClient:await provider.send('web3_clientVersion',[]),seed:26125,methodology:'Local-only controlled tests. Contract attacks use isolated contracts. API tests use synthetic assets. Rejected preflight calls are not labelled mined transactions. Timing is this machine and workload only.',research:'Sequence-based testing inspired by SmartFuzz (2025); this runner does not implement its LLM algorithm.'},tests,measurements:{}};
async function check(name,fn){const start=performance.now();try{const details=await fn();tests.push({name,passed:true,details:details||'Expected property held',durationMs:performance.now()-start});console.log('PASS',name);}catch(e){tests.push({name,passed:false,details:e.shortMessage||e.message,durationMs:performance.now()-start});console.log('FAIL',name,e.shortMessage||e.message);}}
async function api(path,token,body){const r=await fetch(apiUrl+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json().catch(()=>({}))};}
async function login(i){const c=await api('/auth/challenge',null,{controller:wallets[i].address});assert.equal(c.status,200);const body={id:c.body.id,signature:await wallets[i].signMessage(c.body.message)};const v=await api('/auth/verify',null,body);assert.equal(v.status,200,'Restore seeded identities and roles before running experiments');return {token:v.body.token,proof:body};}
const admin=await login(0),manager=await login(1),auditor=await login(2),user=await login(3);
await check('API rejects caller-supplied Admin role',async()=>{const r=await fetch(apiUrl+'/api/files',{method:'POST',headers:{'Content-Type':'application/json','X-Role':'ADMIN'},body:'{}'});assert.equal(r.status,401);assert.equal((await api('/files',user.token,{})).status,403);return 'Unauthenticated request: 401; authenticated User: 403';});
await check('Signed challenge is single-use',async()=>{assert.equal((await api('/auth/verify',null,user.proof)).status,401);return 'Reusing the valid signature after login returned 401';});
await check('Wrong controller signature is rejected',async()=>{const c=await api('/auth/challenge',null,{controller:wallets[3].address});const r=await api('/auth/verify',null,{id:c.body.id,signature:await wallets[4].signMessage(c.body.message)});assert.equal(r.status,401);});
let syntheticId;
await check('Encrypted document ownership and download enforcement',async()=>{
 const content=Buffer.from(`SIH controlled test document\nRun ${runId}\nSynthetic data only.`);
 const f=await api('/files',admin.token,{name:'Security validation document.txt',code:'EXP-'+runId.slice(0,8),description:'Synthetic asset created by the security experiment suite',mime:'text/plain',data:content.toString('base64')});assert.equal(f.status,201);
 syntheticId=Number(await appPlatform.nextId());await(await appPlatform.mint(f.body.codeHash,f.body.contentHash,f.body.uri)).wait();await(await appPlatform.allocate(syntheticId,wallets[3].address)).wait();
 const denied=await fetch(`${apiUrl}/api/assets/${syntheticId}/content`,{headers:{Authorization:'Bearer '+manager.token}});assert.equal(denied.status,403);
 const allowed=await fetch(`${apiUrl}/api/assets/${syntheticId}/content`,{headers:{Authorization:'Bearer '+user.token}});assert.equal(allowed.status,200);assert.deepEqual(Buffer.from(await allowed.arrayBuffer()),content);return `Synthetic token #${syntheticId}: Manager denied, owner receives exact bytes`;
});
if(process.env.DATABASE_URL&&syntheticId) {
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 await check('PostgreSQL ownership-cache tampering cannot alter chain ownership',async()=>{
  assert.equal((await api(`/assets/${syntheticId}/cache`,admin.token,{})).status,200);
  const original=(await pool.query('SELECT * FROM asset_cache WHERE token_id=$1',[syntheticId])).rows[0];
  try{await pool.query('UPDATE asset_cache SET owner=$1 WHERE token_id=$2',[wallets[4].address,syntheticId]);const r=await api(`/assets/${syntheticId}/integrity`,auditor.token);assert.equal(r.body.status,'MISMATCH');assert.equal(r.body.chainOwner,wallets[3].address);}
  finally{await pool.query('UPDATE asset_cache SET owner=$1 WHERE token_id=$2',[original.owner,syntheticId]);}
  return 'Only the new synthetic asset cache was altered, mismatch detected, then restored';
 });
 await check('Read-latency experiment records database and blockchain costs',async()=>{
  const sql=[],chain=[];
  for(let i=0;i<30;i++){let t=performance.now();await pool.query('SELECT owner FROM asset_cache WHERE token_id=$1',[syntheticId]);sql.push(performance.now()-t);t=performance.now();await appPlatform.ownerOf(syntheticId);chain.push(performance.now()-t);}
  const summarize=a=>{const x=[...a].sort((a,b)=>a-b);return {n:a.length,p50:x[Math.floor(x.length*.5)],p95:x[Math.ceil(x.length*.95)-1],mean:a.reduce((a,b)=>a+b)/a.length};};
  report.measurements.ownerLookup={postgresMs:summarize(sql),contractRpcMs:summarize(chain),note:'Cached SQL read versus current contract eth_call. No transaction consensus in either measurement; not a security superiority benchmark.'};raw.push({experiment:'ownerLookup',sqlMs:sql,contractMs:chain});return '30 serial reads per source; raw samples saved, no claimed target';
 });await pool.end();
}else report.environment.omittedExperiments=['PostgreSQL tamper and read-latency tests: DATABASE_URL missing or synthetic asset creation failed'];

console.log('Deploying isolated experiment contracts; main application policies remain unchanged.');
const registry=await new ContractFactory(artifacts.IdentityRegistry.abi,artifacts.IdentityRegistry.bytecode,wallets[0]).deploy(wallets[0].address);await registry.waitForDeployment();
const platform=await new ContractFactory(artifacts.AssetPlatform.abi,artifacts.AssetPlatform.bytecode,wallets[0]).deploy(await registry.getAddress(),wallets[0].address);await platform.waitForDeployment();await(await registry.setGovernance(await platform.getAddress())).wait();
for(let i=1;i<5;i++){await(await registry.connect(wallets[i]).register(wallets[0].address)).wait();await(await platform.setRole(wallets[i].address,[1,2,3,4,4][i])).wait();}
report.environment.isolatedContracts={registry:await registry.getAddress(),platform:await platform.getAddress()};
const hash=s=>keccak256(toUtf8Bytes(s));await(await platform.mint(hash('EXPERIMENT'),hash('data'),'urn:experiment')).wait();await(await platform.allocate(1,wallets[3].address)).wait();
await check('Contract rejects mint, allocation and role escalation',async()=>{
 await assert.rejects(platform.connect(wallets[3]).mint.staticCall(hash('attack'),hash('x'),'urn:attack'));
 await assert.rejects(platform.connect(wallets[1]).allocate.staticCall(1,wallets[4].address));await assert.rejects(platform.connect(wallets[3]).setRole.staticCall(wallets[3].address,1));return 'Three direct contract preflight calls rejected';
});
await check('Mined unauthorised transfer fails without ownership change',async()=>{
 let receipt;try{const t=await platform.connect(wallets[3]).transferFrom(wallets[3].address,wallets[4].address,1,{gasLimit:250000});await t.wait();throw Error('Transfer unexpectedly succeeded');}catch(e){receipt=e.receipt;if(!receipt)throw e;assert.equal(receipt.status,0);}
 assert.equal(await platform.ownerOf(1),wallets[3].address);raw.push({experiment:'minedRejection',transactionHash:receipt.hash,blockNumber:receipt.blockNumber,status:receipt.status});return `Mined status 0: ${receipt.hash}`;
});
await check('Sequence-based permission model holds across 40 seeded transitions',async()=>{
 let seed=26125,owner=wallets[3].address,managerAllowed=true,paused=false,allowedCount=0,deniedCount=0;const sequence=[];
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let step=0;step<40;step++){
  const op=(random()>>>16)%4;
  if(op===0){managerAllowed=!managerAllowed;await(await platform.setRole(wallets[1].address,managerAllowed?2:0)).wait();sequence.push({step,op:'manager-role',managerAllowed});}
  else if(op===1){paused=!paused;await(await platform.setPaused(paused)).wait();sequence.push({step,op:'pause',paused});}
  else{const actor=(random()>>>16)%2?1:3;const target=owner===wallets[3].address?wallets[4].address:wallets[3].address;const allowed=actor===1&&managerAllowed&&!paused;const c=platform.connect(wallets[actor]);
   if(allowed){await(await c.transferFrom(owner,target,1)).wait();owner=target;allowedCount++;}else {await assert.rejects(c.transferFrom.staticCall(owner,target,1));deniedCount++;}
   assert.equal(await platform.ownerOf(1),owner);sequence.push({step,op:'transfer',actor,allowed,owner});
  }
 }
 assert.ok(allowedCount>0&&deniedCount>0,'Sequence must exercise both permitted and denied transfers');
 if(paused)await(await platform.setPaused(false)).wait();await(await platform.setRole(wallets[1].address,2)).wait();raw.push({experiment:'statefulSequences',seed:26125,sequence,allowedCount,deniedCount});return `40 reproducible transitions; ${allowedCount} successful and ${deniedCount} denied transfers, owner invariants checked`;
});
await check('Approval paths cannot bypass transfer policy',async()=>{await assert.rejects(platform.connect(wallets[3]).approve.staticCall(wallets[4].address,1));await assert.rejects(platform.connect(wallets[3]).setApprovalForAll.staticCall(wallets[4].address,true));});
await check('Revoked file access is denied while ownership remains',async()=>{
 const owner=await platform.ownerOf(1);const other=owner===wallets[3].address?wallets[4].address:wallets[3].address;const now=(await provider.getBlock('latest')).timestamp;
 await(await platform.setAccess(1,other,now+3600)).wait();assert.equal(await platform.canRead(1,other),true);await(await platform.setAccess(1,other,0)).wait();assert.equal(await platform.canRead(1,other),false);assert.equal(await platform.ownerOf(1),owner);
});
fs.mkdirSync('experiments/results',{recursive:true});
fs.writeFileSync(`experiments/results/${runId}.json`,JSON.stringify(report,null,2));fs.writeFileSync(`experiments/results/${runId}-raw.json`,JSON.stringify(raw,null,2));
const uploaded=await api('/reports',admin.token,report);assert.equal(uploaded.status,201,'Could not import report');await(await appPlatform.anchorEvidence(uploaded.body.digest,'experiment-report')).wait();
console.log(`Saved ${tests.filter(t=>t.passed).length}/${tests.length} passing checks. Open Security Results in the app.`);
if(tests.some(t=>!t.passed))process.exitCode=1;
provider.destroy();
