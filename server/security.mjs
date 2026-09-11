import crypto from 'node:crypto';
export const sha = v => crypto.createHash('sha256').update(v).digest('hex');
export const canonical = value => JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v);
export function encrypt(bytes,key) {
 const nonce=crypto.randomBytes(12); const c=crypto.createCipheriv('aes-256-gcm',key,nonce);
 return {encrypted:Buffer.concat([c.update(bytes),c.final()]),nonce,tag:c.getAuthTag()};
}
export function decrypt(row,key) {
 const c=crypto.createDecipheriv('aes-256-gcm',key,row.nonce); c.setAuthTag(row.tag);
 return Buffer.concat([c.update(row.encrypted),c.final()]);
}
export function makeLogger(pool,{advisory=true}={}) {
 return async(actor,action,outcome,details='')=>{
  const c=await pool.connect();
  try {
   await c.query('BEGIN'); if(advisory) await c.query('SELECT pg_advisory_xact_lock(26125)');
   const last=await c.query('SELECT digest FROM security_logs ORDER BY id DESC LIMIT 1');
   const record={at:new Date().toISOString(),actor,action,outcome,details,previous_hash:last.rows[0]?.digest||'0'.repeat(64)};
   const digest=sha(canonical(record));
   await c.query('INSERT INTO security_logs(at,actor,action,outcome,details,previous_hash,digest) VALUES($1,$2,$3,$4,$5,$6,$7)',[record.at,actor,action,outcome,details,record.previous_hash,digest]);
   await c.query('COMMIT'); return digest;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 };
}
export function verifyLogs(rows) {
 let previous='0'.repeat(64);
 for(const r of rows) {
  const record={at:r.at,actor:r.actor,action:r.action,outcome:r.outcome,details:r.details,previous_hash:r.previous_hash};
  if(r.previous_hash!==previous || sha(canonical(record))!==r.digest) return {valid:false,firstInvalidId:r.id,head:previous};
  previous=r.digest;
 }
 return {valid:true,count:rows.length,head:previous};
}
