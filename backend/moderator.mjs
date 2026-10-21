import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createInterface} from 'node:readline';

export async function createModerator(){
 const local=process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python';
 const python=process.env.VIDEO_PYTHON??(existsSync(local)?resolve(local):'python');
 const child=spawn(python,['-u',resolve('backend/moderation_worker.py')],{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1'}});
 const pending=new Map();let sequence=0,healthy=false,closed=false;
 let resolveReady;const ready=new Promise(resolve=>{resolveReady=resolve;});
 const stop=()=>{healthy=false;for(const task of pending.values()){clearTimeout(task.timer);task.reject(new Error('Camera screening is unavailable.'));}pending.clear();resolveReady(false);};
 child.on('error',stop);child.on('exit',stop);child.stdin.on('error',stop);
 // Third-party warnings must never leak frames or paths into the client.
 child.stderr.on('data',()=>{});
 const lines=createInterface({input:child.stdout});
 lines.on('line',line=>{let value;try{value=JSON.parse(line);}catch{return;}if(value.ready){healthy=true;resolveReady(true);return;}const task=pending.get(value.id);if(!task)return;pending.delete(value.id);clearTimeout(task.timer);task.resolve(value);});
 const init=setTimeout(()=>{resolveReady(false);child.kill();},20000);
 await ready;clearTimeout(init);
 return {
  get ready(){return healthy&&!closed;},
  async inspect(image){if(!healthy||closed)throw new Error('Camera screening is unavailable.');if(pending.size>=4)throw new Error('Camera screening is busy. Please try again.');const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);healthy=false;reject(new Error('Camera screening timed out.'));child.kill();},4000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,image:image.toString('base64')})+'\n');});},
  async close(){closed=true;stop();lines.close();child.kill();}
 };
}
