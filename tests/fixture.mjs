import ganache from 'ganache';
import {BrowserProvider,Wallet,NonceManager,ContractFactory,keccak256,toUtf8Bytes,ZeroAddress} from 'ethers';
import {compile} from '../scripts/compile.mjs';
export async function fixture() {
 const engine=ganache.provider({logging:{quiet:true},chain:{chainId:26125},wallet:{totalAccounts:10},miner:{instamine:'eager'}});
 const provider=new BrowserProvider(engine,undefined,{cacheTimeout:-1});provider.pollingInterval=20;
 const wallets=Object.values(engine.getInitialAccounts()).map(a=>new Wallet(a.secretKey,provider));
 const signers=wallets;const artifacts=compile();
 const registry=await new ContractFactory(artifacts.IdentityRegistry.abi,artifacts.IdentityRegistry.bytecode,signers[0]).deploy(wallets[0].address);await registry.waitForDeployment();
 const platform=await new ContractFactory(artifacts.AssetPlatform.abi,artifacts.AssetPlatform.bytecode,signers[0]).deploy(await registry.getAddress(),wallets[0].address);await platform.waitForDeployment();
 await(await registry.setGovernance(await platform.getAddress())).wait();
 for(let i=1;i<6;i++){await(await registry.connect(signers[i]).register(wallets[0].address)).wait();await(await platform.setRole(wallets[i].address,[1,2,3,4,4,4][i])).wait();}
 const deployment={registry:await registry.getAddress(),platform:await platform.getAddress(),chainId:26125,blockNumber:0};
 async function mint(code='TEST-1') {const id=Number(await platform.nextId());await(await platform.mint(keccak256(toUtf8Bytes(code)),keccak256(toUtf8Bytes('content')),'urn:test:'+code)).wait();return id;}
 return {engine,provider,wallets,signers,registry,platform,artifacts,deployment,mint,close:()=>engine.disconnect()};
}
