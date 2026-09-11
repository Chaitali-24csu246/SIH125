import {PGlite} from '@electric-sql/pglite';
// Real PostgreSQL engine compiled to WASM for local verification; production uses pg over TCP.
export async function memoryPool() {
 const db=new PGlite();await db.waitReady;
 const query=async(sql,params)=>params?db.query(sql,params):sql.includes(';')?{rows:await db.exec(sql)}:db.query(sql);
 return {query,connect:async()=>({query,release(){}}),end:()=>db.close()};
}
