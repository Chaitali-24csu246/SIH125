import fs from 'node:fs';
import {JsonRpcProvider,Wallet,ContractFactory,Contract,NonceManager,keccak256,toUtf8Bytes} from 'ethers';
import {compile} from './compile.mjs';
const artifacts=compile();
const provider=new JsonRpcProvider(process.env.RPC_URL||'http://localhost:8545',undefined,{cacheTimeout:-1});
const chainId=Number((await provider.getNetwork()).chainId);if(chainId!==26125)throw Error('Refusing deployment on another chain');
const accounts=JSON.parse(fs.readFileSync('generated/accounts.json'));
const signers=accounts.map(a=>new NonceManager(new Wallet(a.privateKey,provider)));
if(fs.existsSync('generated/deployment.json')) {const old=JSON.parse(fs.readFileSync('generated/deployment.json'));if(await provider.getCode(old.platform)!=='0x')throw Error('Already deployed. Reuse existing deployment.');}
const registry=await new ContractFactory(artifacts.IdentityRegistry.abi,artifacts.IdentityRegistry.bytecode,signers[0]).deploy(accounts[0].address);await registry.waitForDeployment();
const platform=await new ContractFactory(artifacts.AssetPlatform.abi,artifacts.AssetPlatform.bytecode,signers[0]).deploy(await registry.getAddress(),accounts[0].address);await platform.waitForDeployment();
await (await registry.setGovernance(await platform.getAddress())).wait();
for(let i=1;i<accounts.length;i++) {await(await registry.connect(signers[i]).register(accounts[0].address)).wait();await(await platform.setRole(accounts[i].address,[1,2,3,4,4][i])).wait();}
// Admin guardian is the Auditor. Recovery uses the contract's 24-hour delay.
await(await registry.setGuardian(accounts[2].address)).wait();
const receipt=await registry.deploymentTransaction().wait();
fs.writeFileSync('generated/deployment.json',JSON.stringify({chainId,registry:await registry.getAddress(),platform:await platform.getAddress(),blockNumber:receipt.blockNumber,accounts:accounts.map(({name,address})=>({name,address}))},null,2));
console.log('Contracts deployed and five identities registered. Start the app, then mint a document in Assets.');
