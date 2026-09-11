import {JsonRpcProvider} from 'ethers';
const p=new JsonRpcProvider(process.env.RPC_URL||'http://localhost:8545',undefined,{cacheTimeout:-1});
let previous=-1;let ready=false;
for(let i=0;i<45;i++){try{const n=await p.getBlockNumber();if(previous>=0&&n>previous){ready=true;break;}previous=n;}catch{}await new Promise(r=>setTimeout(r,2000));}
p.destroy();if(!ready)throw Error('Network did not produce blocks. Inspect Besu container logs and validator connectivity.');console.log('Blockchain is producing blocks.');
