import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {keccak256,toUtf8Bytes,ZeroAddress} from 'ethers';
import {fixture} from './fixture.mjs';
let f;
before(async()=>{f=await fixture();});after(async()=>{await f.close();});
test('Admin-only mint and allocation, including Manager allocation bypass',async()=>{
 const {platform:p,signers:s,wallets:w,mint}=f;const id=await mint('GOVERNANCE');
 await assert.rejects(p.connect(s[3]).mint(keccak256(toUtf8Bytes('X')),keccak256(toUtf8Bytes('Y')),'urn:test'));
 await assert.rejects(p.connect(s[1]).allocate(id,w[3].address));
 await(await p.allocate(id,w[3].address)).wait();assert.equal(await p.ownerOf(id),w[3].address);
});
test('User and Auditor cannot transfer; Manager transfer succeeds',async()=>{
 const {platform:p,signers:s,wallets:w,mint}=f;const id=await mint('TRANSFERS');await(await p.allocate(id,w[3].address)).wait();
 for(const i of [2,3])await assert.rejects(p.connect(s[i]).transferFrom(w[3].address,w[4].address,id));
 assert.equal(await p.ownerOf(id),w[3].address);await(await p.connect(s[1]).transferFrom(w[3].address,w[4].address,id)).wait();assert.equal(await p.ownerOf(id),w[4].address);
});
test('ERC721 approvals and safe-transfer path cannot bypass policy',async()=>{
 const {platform:p,signers:s,wallets:w,mint}=f;const id=await mint('BYPASS');await(await p.allocate(id,w[3].address)).wait();
 await assert.rejects(p.connect(s[3]).approve(w[4].address,id));await assert.rejects(p.connect(s[3]).setApprovalForAll(w[4].address,true));
 await assert.rejects(p.connect(s[3])['safeTransferFrom(address,address,uint256)'](w[3].address,w[4].address,id));
 assert.equal(await p.ownerOf(id),w[3].address);
});
test('Revocation takes effect after previously successful authority',async()=>{
 const {platform:p,signers:s,wallets:w,mint}=f;const id=await mint('REVOKE');await(await p.allocate(id,w[3].address)).wait();
 await(await p.connect(s[1]).transferFrom(w[3].address,w[4].address,id)).wait();await(await p.setRole(w[1].address,0)).wait();
 await assert.rejects(p.connect(s[1]).transferFrom(w[4].address,w[3].address,id));assert.equal(await p.ownerOf(id),w[4].address);
 await(await p.setRole(w[1].address,2)).wait();
});
test('Duplicate code registration fails',async()=>{await f.mint('UNIQUE');await assert.rejects(f.mint('UNIQUE'));});
test('Time-limited file access expires and transfer invalidates grants',async()=>{
 const {platform:p,wallets:w,provider,mint,engine}=f;const id=await mint('ACCESS');await(await p.allocate(id,w[3].address)).wait();let now=(await provider.getBlock('latest')).timestamp;
 await(await p.setAccess(id,w[4].address,now+20)).wait();assert.equal(await p.canRead(id,w[4].address),true);
 await engine.request({method:'evm_increaseTime',params:[30]});await engine.request({method:'evm_mine',params:[]});assert.equal(await p.canRead(id,w[4].address),false);
 now=(await provider.getBlock('latest')).timestamp;await(await p.setAccess(id,w[4].address,now+1000)).wait();
 await(await p.transferFrom(w[3].address,w[5].address,id)).wait();assert.equal(await p.canRead(id,w[4].address),false);assert.equal(await p.canRead(id,w[5].address),true);
});
test('Pause and suspension block operations; governance survives pause',async()=>{
 const {platform:p,signers:s,wallets:w,mint}=f;const id=await mint('PAUSE');await(await p.allocate(id,w[3].address)).wait();
 await(await p.setPaused(true)).wait();assert.equal(await p.canRead(id,w[3].address),false);await assert.rejects(p.connect(s[1]).transferFrom(w[3].address,w[4].address,id));
 await(await p.setSuspended(w[3].address,true)).wait();await(await p.setPaused(false)).wait();assert.equal(await p.canRead(id,w[3].address),false);
 await(await p.setSuspended(w[3].address,false)).wait();assert.equal(await p.canRead(id,w[3].address),true);
});
test('Rotation preserves DID ownership and invalidates old controller',async()=>{
 const {platform:p,registry:r,signers:s,wallets:w,mint}=f;const id=await mint('ROTATE');await(await p.allocate(id,w[5].address)).wait();
 await(await r.connect(s[5]).rotate(w[6].address)).wait();assert.equal(await p.ownerOf(id),w[5].address);assert.equal(await r.identityForController(w[6].address),w[5].address);
 await assert.rejects(r.connect(s[5]).setGuardian(w[0].address));assert.equal(await r.identityForController(w[5].address),ZeroAddress);
});
test('Guardian recovery requires delay; current controller can cancel',async()=>{
 const {registry:r,signers:s,wallets:w,engine}=f;
 await(await r.requestRecovery(w[5].address,w[7].address)).wait();await assert.rejects(r.completeRecovery(w[5].address));
 await(await r.connect(s[6]).cancelRecovery()).wait();await assert.rejects(r.completeRecovery(w[5].address));
 await(await r.requestRecovery(w[5].address,w[7].address)).wait();await engine.request({method:'evm_increaseTime',params:[86401]});await engine.request({method:'evm_mine',params:[]});
 await(await r.completeRecovery(w[5].address)).wait();assert.equal(await r.controllerOf(w[5].address),w[7].address);
});
test('Final Admin cannot be demoted, suspended or self-deactivated',async()=>{
 const {platform:p,registry:r,wallets:w}=f;await assert.rejects(p.setRole(w[0].address,0));await assert.rejects(p.setSuspended(w[0].address,true));await assert.rejects(r.deactivate());
});
test('Retirement permanently blocks transfers and downloads',async()=>{
 const {platform:p,wallets:w,mint}=f;const id=await mint('RETIRE');await(await p.allocate(id,w[3].address)).wait();await(await p.retire(id)).wait();
 assert.equal(await p.canRead(id,w[0].address),false);await assert.rejects(p.transferFrom(w[3].address,w[4].address,id));
});
