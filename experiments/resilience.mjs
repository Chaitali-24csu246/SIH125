import fs from 'node:fs';
import {JsonRpcProvider} from 'ethers';
const p=new JsonRpcProvider(process.env.RPC_URL||'http://localhost:8545',undefined,{cacheTimeout:-1});
const before=await p.getBlockNumber();await new Promise(r=>setTimeout(r,10000));const after=await p.getBlockNumber();
const result={experiment:'One validator stopped by operator',timestamp:new Date().toISOString(),before,after,passed:after>before,observationWindowSeconds:10,note:'Measures continued block production only; all containers on one host share host failure risk.'};
fs.mkdirSync('experiments/results',{recursive:true});fs.writeFileSync('experiments/results/resilience.json',JSON.stringify(result,null,2));console.log(result);p.destroy();if(!result.passed)process.exitCode=1;
