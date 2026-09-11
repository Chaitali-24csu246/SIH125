import fs from 'node:fs';
import pg from 'pg';
import {JsonRpcProvider,Contract} from 'ethers';
const failures=[];
async function check(name,fn){try{console.log('OK',name,await fn()||'');}catch(e){failures.push(name);console.error('FAIL',name,e.shortMessage||e.message);}}
await check('Generated files',async()=>{for(const p of ['generated/network/genesis.json','generated/deployment.json','generated/artifacts.json','generated/config.env'])if(!fs.existsSync(p))throw Error('Missing '+p);});
const provider=new JsonRpcProvider(process.env.RPC_URL||'http://localhost:8545',undefined,{cacheTimeout:-1});
await check('Chain ID',async()=>{const id=Number((await provider.getNetwork()).chainId);if(id!==26125)throw Error('Wrong chain '+id);return id;});
await check('Deployed contracts',async()=>{const d=JSON.parse(fs.readFileSync('generated/deployment.json'));for(const a of [d.registry,d.platform])if(await provider.getCode(a)==='0x')throw Error('Missing code at '+a);return 'Both contracts found';});
if(process.env.DATABASE_URL){const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});await check('PostgreSQL and application role',async()=>{const r=await pool.query('SELECT current_user');return r.rows[0].current_user;});await pool.end();}
await check('Application health',async()=>{const r=await fetch((process.env.API_URL||'http://localhost:8080')+'/api/health',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('HTTP '+r.status);return JSON.stringify(await r.json());});
provider.destroy();if(failures.length)process.exitCode=1;
