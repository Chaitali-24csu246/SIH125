import fs from 'node:fs';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {Wallet,JsonRpcProvider,ContractFactory,keccak256,toUtf8Bytes} from 'ethers';
import {compile} from '../scripts/compile.mjs';
const provider=new JsonRpcProvider(process.env.RPC_URL||'http://localhost:8545',undefined,{cacheTimeout:-1});provider.pollingInterval=250;
if(Number((await provider.getNetwork()).chainId)!==26125)throw Error('Local chain only');
const a=JSON.parse(fs.readFileSync('generated/accounts.json'))[0],signer=new Wallet(a.privateKey,provider),artifacts=compile();
const counts=(process.env.BENCH_COUNTS||'10,25,50').split(',').map(Number);if(counts.some(x=>!Number.isInteger(x)||x<1||x>10000))throw Error('Each BENCH_COUNTS value must be 1..10000');
const registry=await new ContractFactory(artifacts.IdentityRegistry.abi,artifacts.IdentityRegistry.bytecode,signer).deploy(a.address);await registry.waitForDeployment();
const platform=await new ContractFactory(artifacts.AssetPlatform.abi,artifacts.AssetPlatform.bytecode,signer).deploy(await registry.getAddress(),a.address);await platform.waitForDeployment();await(await registry.setGovernance(await platform.getAddress())).wait();
const summary=values=>{const s=[...values].sort((a,b)=>a-b),q=p=>s[Math.max(0,Math.ceil(s.length*p)-1)];return {n:s.length,meanMs:s.reduce((a,b)=>a+b)/s.length,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),minMs:s[0],maxMs:s.at(-1)};};
const report={title:'Isolated contract workload benchmark',timestamp:new Date().toISOString(),environment:{client:await provider.send('web3_clientVersion',[]),node:process.version,cpu:os.cpus()[0]?.model,chainId:26125,contract:await platform.getAddress()},methodology:'Serial mint submission-to-receipt latency and batches of ten ownerOf eth_call reads. Not maximum network capacity. No gas currency valuation on zero-fee local network. Percentiles are descriptive for these small samples.',workloads:[]};
let serial=0;
for(const n of counts){const latencies=[],gas=[];const begin=performance.now();for(let i=0;i<n;i++){const started=performance.now();const r=await(await platform.mint(keccak256(toUtf8Bytes('BENCH-'+(++serial))),keccak256(toUtf8Bytes('file')),'urn:benchmark')).wait();latencies.push(performance.now()-started);gas.push(Number(r.gasUsed));}
 const duration=performance.now()-begin,reads=[];const readStart=performance.now();for(let i=0;i<n;i+=10){await Promise.all(Array.from({length:Math.min(10,n-i)},async(_,j)=>{const t=performance.now();await platform.ownerOf(1+(i+j)%serial);reads.push(performance.now()-t);}));}
 report.workloads.push({newAssets:n,totalAssets:serial,writeLatency:summary(latencies),serialWriteOpsPerSecond:n/(duration/1000),readLatency:summary(reads),readOpsPerSecond:n/((performance.now()-readStart)/1000),raw:{writeMs:latencies,readMs:reads,gas}});console.log('Finished workload',n);
}
fs.mkdirSync('experiments/results',{recursive:true});const file='experiments/results/benchmark-'+Date.now()+'.json';fs.writeFileSync(file,JSON.stringify(report,null,2));console.log('Saved',file);provider.destroy();
