// Verification harness only. Does not replace the Besu + PostgreSQL deployment.
// Refuses to overwrite an initialised Besu network.
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fixture} from '../tests/fixture.mjs';
import {memoryPool} from '../tests/database.mjs';
import {createApp} from '../server/app.mjs';
if(fs.existsSync('generated/network/genesis.json'))throw Error('Use a separate project copy for local verification; a Besu network already exists.');
const f=await fixture();const pool=await memoryPool();
fs.writeFileSync('generated/VERIFICATION-ONLY.txt','Ganache and PGlite verification harness. Remove generated/deployment.json and accounts.json before real initialisation.');
fs.writeFileSync('generated/deployment.json',JSON.stringify(f.deployment));
fs.writeFileSync('generated/accounts.json',JSON.stringify(f.wallets.slice(0,5).map((w,i)=>({name:['Admin','Manager','Auditor','Rahul','Priya'][i],address:w.address,privateKey:w.privateKey}))),{mode:0o600});
const rpc=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:8080');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS'){res.end();return;}
 let body='';for await(const chunk of req)body+=chunk;
 try{const input=JSON.parse(body);const execute=async c=>{try{return {jsonrpc:'2.0',id:c.id,result:await f.engine.request({method:c.method,params:c.params||[]})};}catch(e){return {jsonrpc:'2.0',id:c.id,error:{code:e.code||-32000,message:e.message,data:e.data}};}};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(Array.isArray(input)?await Promise.all(input.map(execute)):await execute(input)));}catch{res.statusCode=400;res.end();}
});rpc.listen(8545,'127.0.0.1');
const {app}=await createApp({...f,pool,encryptionKey:crypto.randomBytes(32),advisory:false,rateLimit:10000});
const server=app.listen(8080,'127.0.0.1',()=>console.log('Verification harness ready at http://localhost:8080 (Ganache + PostgreSQL WASM engine)'));
if(process.env.VERIFY_RUN_EXPERIMENTS==='1') {
 const child=spawn(process.execPath,['experiments/run.mjs'],{stdio:'inherit',env:{...process.env,RPC_URL:'http://127.0.0.1:8545',API_URL:'http://127.0.0.1:8080'}});
 child.on('exit',async code=>{server.close();rpc.close();await pool.end();await f.close();process.exit(code||0);});
}
process.on('SIGTERM',async()=>{server.close();rpc.close();await pool.end();await f.close();process.exit(0);});
