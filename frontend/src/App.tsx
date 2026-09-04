import { FormEvent, useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'USER'
type User = { id:number; name:string; email:string; role:Role }
type Asset = { id:number; asset_code:string; name:string; serial_number:string; status:string; owner_id:number|null; owner_name:string|null }
type Audit = { id:number; actor_role:string; actor_name:string; action:string; asset_id:number|null; details:string; created_at:string }

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function App(){
  const [role,setRole]=useState<Role>('ADMIN')
  const [users,setUsers]=useState<User[]>([])
  const [assets,setAssets]=useState<Asset[]>([])
  const [audit,setAudit]=useState<Audit[]>([])
  const [message,setMessage]=useState('')
  const [tab,setTab]=useState<'assets'|'audit'>('assets')
  const [form,setForm]=useState({asset_code:'BEL-LT-001',name:'Secure Testing Laptop',serial_number:'SN-001'})

  const normalUsers=useMemo(()=>users.filter(u=>u.role==='USER'),[users])

  async function request(path:string, options:RequestInit={}){
    const headers={ 'Content-Type':'application/json', 'X-Role':role, ...(options.headers||{}) }
    const res=await fetch(`${API}${path}`,{...options,headers})
    if(!res.ok){ const body=await res.json().catch(()=>({detail:'Request failed'})); throw new Error(body.detail||'Request failed') }
    return res.json()
  }

  async function refresh(){
    try{
      const [u,a]=await Promise.all([fetch(`${API}/users`).then(r=>r.json()),fetch(`${API}/assets`).then(r=>r.json())])
      setUsers(u); setAssets(a)
      if(role==='ADMIN'||role==='AUDITOR') setAudit(await request('/audit'))
      else setAudit([])
    }catch(e:any){setMessage(`Backend not reachable: ${e.message}`)}
  }

  useEffect(()=>{refresh()},[role])

  async function createAsset(e:FormEvent){
    e.preventDefault(); setMessage('')
    try{ await request('/assets',{method:'POST',body:JSON.stringify(form)}); setMessage('Asset created successfully.'); await refresh() }
    catch(e:any){setMessage(e.message)}
  }

  async function transfer(assetId:number,newOwnerId:number){
    if(!newOwnerId) return
    setMessage('')
    try{ await request(`/assets/${assetId}/transfer`,{method:'POST',body:JSON.stringify({new_owner_id:newOwnerId})}); setMessage('Asset transferred successfully.'); await refresh() }
    catch(e:any){setMessage(e.message)}
  }

  return <div className="app">
    <header><div><h1>Secure Asset Prototype</h1><p>SIH 26125 • Centralized baseline</p></div><span className="badge">v0.1</span></header>

    <section className="rolebar">
      <strong>Demo login:</strong>
      {(['ADMIN','MANAGER','AUDITOR','USER'] as Role[]).map(r=><button key={r} className={role===r?'active':''} onClick={()=>setRole(r)}>{r}</button>)}
    </section>

    <nav><button className={tab==='assets'?'active':''} onClick={()=>setTab('assets')}>Assets</button><button className={tab==='audit'?'active':''} onClick={()=>setTab('audit')}>Audit Trail</button></nav>
    {message&&<div className="message">{message}</div>}

    {tab==='assets' && <main>
      {role==='ADMIN' && <section className="card"><h2>Create Asset</h2><form onSubmit={createAsset}>
        <input value={form.asset_code} onChange={e=>setForm({...form,asset_code:e.target.value})} placeholder="Asset code" required/>
        <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Asset name" required/>
        <input value={form.serial_number} onChange={e=>setForm({...form,serial_number:e.target.value})} placeholder="Serial number" required/>
        <button type="submit">Create Asset</button>
      </form></section>}

      <section className="card"><h2>{role==='USER'?'My Assets':'Assets'}</h2>
        {assets.length===0?<p>No assets yet.</p>:<div className="grid">{assets.filter(a=>role!=='USER'||a.owner_name==='Rahul User').map(a=><article key={a.id} className="asset">
          <div><small>{a.asset_code}</small><h3>{a.name}</h3><p>Serial: {a.serial_number}</p><p>Owner: <strong>{a.owner_name||'Unassigned'}</strong></p></div>
          {(role==='ADMIN'||role==='MANAGER')&&<select defaultValue="" onChange={e=>transfer(a.id,Number(e.target.value))}>
            <option value="" disabled>Assign / transfer to...</option>{normalUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>}
        </article>)}</div>}
        {role==='AUDITOR'&&<p className="hint">Auditor can view assets but cannot create or transfer them.</p>}
      </section>
    </main>}

    {tab==='audit' && <main><section className="card"><h2>Audit Trail</h2>
      {(role!=='ADMIN'&&role!=='AUDITOR')?<div className="denied"><h3>403 — Access denied</h3><p>Only ADMIN and AUDITOR may view the audit trail.</p></div>:
      audit.length===0?<p>No audit events yet.</p>:<div className="timeline">{audit.map(a=><div key={a.id}><strong>{a.action}</strong><span>{a.actor_name} ({a.actor_role})</span><p>{a.details}</p><small>{a.created_at}</small></div>)}</div>}
    </section></main>}
  </div>
}
