import { spawn } from 'node:child_process';
const processes=[spawn(process.execPath,['--env-file-if-exists=.env','backend/server.mjs'],{stdio:'inherit'}),spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'})];
let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const p of processes)p.kill();}
for(const p of processes)p.on('exit',code=>{stop();process.exitCode=code??0;});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
