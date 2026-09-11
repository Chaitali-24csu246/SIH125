// npm can record Ganache's bundled macOS watcher as non-optional/extraneous.
// Its entire nested tree is development-only; preserve that classification for npm ci.
import fs from 'node:fs';
const lock=JSON.parse(fs.readFileSync('package-lock.json'));
for(const [name,entry] of Object.entries(lock.packages||{}))if(name.startsWith('node_modules/ganache/node_modules/')){entry.dev=true;if(name.endsWith('/fsevents'))entry.optional=true;}
fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
