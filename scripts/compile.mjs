import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
export function compile() {
 const sources = Object.fromEntries(['IdentityRegistry','AssetPlatform'].map(n=>[`${n}.sol`,{content:fs.readFileSync(`contracts/${n}.sol`,'utf8')} ]));
 const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),{import:p=>{try{return {contents:fs.readFileSync(p.startsWith('@')?path.join('node_modules',p):path.join('contracts',p),'utf8')}}catch{return {error:`Missing import ${p}`}}}}));
 const errors=(out.errors||[]).filter(x=>x.severity==='error'); if(errors.length) throw Error(errors.map(e=>e.formattedMessage).join('\n'));
 fs.mkdirSync('generated',{recursive:true});
 const artifacts={};for(const name of ['IdentityRegistry','AssetPlatform']) {const c=out.contracts[`${name}.sol`][name]; artifacts[name]={abi:c.abi,bytecode:'0x'+c.evm.bytecode.object};}
 fs.writeFileSync('generated/artifacts.json',JSON.stringify(artifacts,null,2));return artifacts;
}
if(process.argv[1]?.endsWith('compile.mjs')) {compile(); console.log('Contracts compiled');}
