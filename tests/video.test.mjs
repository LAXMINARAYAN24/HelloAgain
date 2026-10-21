import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createApplication} from '../backend/app.mjs';
import {createModerator} from '../backend/moderator.mjs';

const picture=readFileSync(new URL('./fixtures/clothed-camera.jpg',import.meta.url));
const password='Private-video-test-password-2026!';
const waitUntil=async(predicate,message='Condition did not become true')=>{const deadline=Date.now()+5000;while(!predicate()){if(Date.now()>deadline)throw new Error(message);await new Promise(r=>setTimeout(r,30));}};
async function fixture(t){
 const mode={value:'clear'};const moderator={ready:true,inspect:async()=>{if(mode.value==='error')throw new Error('Screening failed');if(mode.value==='exposure')return {allowed:false,reason:'exposure',label:'MALE_BREAST_EXPOSED',score:.91};return {allowed:mode.value==='clear',reason:mode.value==='black'?'black_screen':'clear'};},close:async()=>{}};
 const runtime=await createApplication({databasePath:':memory:',databaseUrl:'',demo:false,videoModerator:moderator,production:false,origin:'http://127.0.0.1:4313'});
 const server=runtime.app.listen(0,'127.0.0.1');runtime.video.attach(server);await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;const sockets=[];
 t.after(async()=>{for(const ws of sockets)ws.terminate();runtime.video.finishAll();server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.close();});
 async function member(name,gender){const result=await fetch(base+'/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:name.toLowerCase()+'@example.test',password,name,dob:'1999-03-24',gender,city:'Raipur',bio:'A private call testing profile.',interests:['Music'],color:'sage',acceptRules:true,acceptPrivacy:true})});assert.equal(result.status,201);const cookie=result.headers.get('set-cookie').split(';')[0],user=(await result.json()).user;return {user,cookie,async request(path,body,method=body===undefined?'GET':'POST'){const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}};}
 const a=await member('Anton','man'),b=await member('Bea','woman'),stranger=await member('Cory','man');
 const invited=await a.request('/connections',{target:b.user.id});const connectionId=invited.data.id;await b.request(`/connections/${connectionId}/respond`,{accept:true});
 async function preflight(person){const r=await person.request('/video/preflight',{image:picture.toString('base64'),acceptRules:true});assert.equal(r.status,200);assert.equal(r.data.allowed,true);}
 async function start(){await preflight(a);const result=await a.request('/video/calls',{connectionId,acceptRules:true});assert.equal(result.status,200,JSON.stringify(result));return result.data.call;}
 async function accept(call){await preflight(b);const r=await b.request(`/video/calls/${call.id}/respond`,{accept:true,acceptRules:true});assert.equal(r.status,200,JSON.stringify(r));}
 async function connect(person,call,{origin='http://127.0.0.1:4313'}={}){const ws=new WebSocket(base.replace('http:','ws:')+'/api/video/stream?call='+call.id,{headers:{Cookie:person.cookie,Origin:origin}});sockets.push(ws);const records=[];ws.on('message',(data,binary)=>records.push(binary?{binary:true,data:Buffer.from(data)}:JSON.parse(data.toString())));await once(ws,'open');return {ws,records};}
 return {runtime,base,mode,a,b,stranger,connectionId,preflight,start,accept,connect};
}

test('real on-server model accepts a clothed adult image and fails closed on malformed media',async()=>{
 const moderator=await createModerator();try{assert.equal(moderator.ready,true,'Run the video setup script first.');const verdict=await moderator.inspect(picture);assert.equal(verdict.allowed,true,JSON.stringify(verdict));const invalid=await moderator.inspect(Buffer.from('not an image'));assert.equal(invalid.allowed,false);}finally{await moderator.close();}
});

test('calls require camera checks, accepted connections, recipient consent, and authenticated membership',async t=>{
 const f=await fixture(t);
 assert.equal((await f.a.request('/video/calls',{connectionId:f.connectionId,acceptRules:true})).status,403);
 const call=await f.start();
 assert.equal((await f.stranger.request('/video/status')).data.calls.length,0);
 assert.equal((await f.stranger.request(`/video/calls/${call.id}/respond`,{accept:true,acceptRules:true})).status,404);
 assert.equal((await f.b.request(`/video/calls/${call.id}/respond`,{accept:true,acceptRules:true})).status,403);
 assert.equal((await f.a.request(`/video/calls/${call.id}/respond`,{accept:true,acceptRules:true})).status,409);
 await f.accept(call);
 await assert.rejects(f.connect(f.stranger,call));
 await assert.rejects(f.connect(f.a,call,{origin:'https://attacker.example'}));
 const a=await f.connect(f.a,call),b=await f.connect(f.b,call);
 a.ws.send(Buffer.alloc(4801,2));await new Promise(r=>setTimeout(r,100));assert.equal(b.records.filter(x=>x.binary).length,0,'Audio must wait for checked camera frames from both people.');
 a.ws.send(Buffer.concat([Buffer.from([1]),picture]));b.ws.send(Buffer.concat([Buffer.from([1]),picture]));
 await waitUntil(()=>a.records.some(x=>x.binary)&&b.records.some(x=>x.binary));
 const audio=Buffer.alloc(4801);audio[0]=2;a.ws.send(audio);await waitUntil(()=>b.records.some(x=>x.binary&&x.data[0]===2));
 const outgoing=(await f.a.request('/video/status')).data.calls[0];assert.equal(outgoing.status,'accepted');
 await f.b.request('/blocks',{target:f.a.user.id});await waitUntil(()=>a.records.some(x=>x.type==='ended'));
 assert.equal((await f.a.request('/video/status')).data.calls.length,0);
});

test('black frames are withheld and clear the remote picture; exposure stops the call and suspends the source',async t=>{
 const f=await fixture(t),call=await f.start();await f.accept(call);const a=await f.connect(f.a,call),b=await f.connect(f.b,call);
 f.mode.value='black';a.ws.send(Buffer.concat([Buffer.from([1]),picture]));await waitUntil(()=>b.records.some(x=>x.type==='clear'));
 assert.equal(b.records.filter(x=>x.binary).length,0,'Unapproved pictures must never reach the other person.');
 assert.equal((await f.a.request('/me')).data.user.status,'active','Darkness alone must not ban the account.');
 await new Promise(r=>setTimeout(r,250));f.mode.value='exposure';a.ws.send(Buffer.concat([Buffer.from([1]),picture]));await waitUntil(()=>b.records.some(x=>x.type==='ended'));
 await waitUntil(()=>f.runtime.video.ready());
 // Wait for the automatic suspension transaction that follows immediate media cutoff.
 const deadline=Date.now()+3000;let user;do{user=await f.runtime.store.transaction(db=>db.get('SELECT status FROM users WHERE id=?',[f.a.user.id]));if(user.status==='suspended')break;await new Promise(r=>setTimeout(r,25));}while(Date.now()<deadline);
 assert.equal(user.status,'suspended');assert.equal(b.records.filter(x=>x.binary).length,0);
 const reports=await f.runtime.store.transaction(db=>db.all('SELECT * FROM reports WHERE target=?',[f.a.user.id]));assert.equal(reports.length,1);assert.equal(reports[0].context,'[]');
 assert.equal((await f.a.request(`/connections/${f.connectionId}/messages`,{body:'After suspension'})).status,401);
});

test('screening outages stop the call and never forward unchecked camera images',async t=>{
 const f=await fixture(t),call=await f.start();await f.accept(call);const a=await f.connect(f.a,call),b=await f.connect(f.b,call);f.mode.value='error';a.ws.send(Buffer.concat([Buffer.from([1]),picture]));await waitUntil(()=>b.records.some(x=>x.type==='ended'));assert.equal(b.records.filter(x=>x.binary).length,0);
});

test('random matching requires checked cameras and opposite genders, isolates text, and respects Stop and blocks',async t=>{
 const f=await fixture(t);
 assert.equal((await f.a.request('/video/random/join',{acceptRules:true,preference:'opposite'})).status,403);
 for(const person of [f.a,f.b,f.stranger])await f.preflight(person);
 assert.equal((await f.a.request('/video/random/join',{acceptRules:false})).status,403);
 assert.equal((await f.a.request('/video/random/join',{acceptRules:true,preference:'opposite'})).data.waiting,true);
 assert.equal((await f.stranger.request('/video/random/join',{acceptRules:true,preference:'opposite'})).data.waiting,true);
 const result=await f.b.request('/video/random/join',{acceptRules:true,preference:'opposite'});assert.equal(result.status,200);const call=result.data.call;
 assert.equal(call.random,true);assert.equal(call.status,'accepted');assert.equal(call.person.id,f.a.user.id);
 assert.deepEqual(Object.keys(call.person).sort(),['gender','id','name']);
 assert.equal((await f.a.request('/video/random/status')).data.call.id,call.id);
 assert.equal((await f.stranger.request(`/video/random/${call.id}/messages`)).status,404);
 assert.equal((await f.a.request(`/video/random/${call.id}/messages`,{body:'Private room text'})).status,200);
 assert.equal((await f.b.request(`/video/random/${call.id}/messages`)).data.messages[0].body,'Private room text');
 await f.stranger.request('/blocks',{target:f.b.user.id});
 assert.equal((await f.a.request('/video/random/status')).data.call.id,call.id,'Blocking a different person must not disconnect this room.');
 await f.a.request('/video/random/stop',{});
 assert.equal((await f.b.request('/video/random/status')).data.call,null);
 assert.equal((await f.a.request(`/video/random/${call.id}/messages`,{body:'Too late'})).status,404);
 assert.equal((await f.a.request(`/connections/${call.connectionId}/messages`)).status,403);
 await f.b.request('/blocks',{target:f.stranger.user.id});await f.preflight(f.b);
 assert.equal((await f.b.request('/video/random/join',{acceptRules:true,preference:'opposite'})).data.waiting,true);
 assert.equal((await f.stranger.request('/video/random/status')).data.call,null);
});


test('removed demonstration routes and alternate test-token authentication stay unavailable',async t=>{
 const f=await fixture(t);
 assert.equal((await f.a.request('/lab/bootstrap',{})).status,404);
 assert.equal((await f.a.request('/lab/camera.jpg')).status,404);
 const base=f.base;
 for(const path of ['/call-lab','/call-lab/','/call-lab/nested'])assert.equal((await fetch(base+path)).status,404);
 const token=f.a.cookie.split('=')[1];
 const response=await fetch(base+'/api/video/random/status',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,401);
 const unauthorized=new WebSocket(base.replace('http:','ws:')+'/api/video/stream?call=removed',['helloagain-lab',token],{headers:{Origin:'http://127.0.0.1:4313'}});unauthorized.on('error',()=>{});await assert.rejects(once(unauthorized,'open'));unauthorized.terminate();
 assert.equal('videoTestMode' in (await f.a.request('/config')).data,false);
});

test('Random allows same-gender rooms with private text and screened media, while invalid choices cannot interrupt a call',async t=>{
 const f=await fixture(t);await f.preflight(f.a);await f.preflight(f.stranger);
 assert.equal((await f.a.request('/video/random/join',{acceptRules:true,preference:'random'})).data.waiting,true);
 const joined=await f.stranger.request('/video/random/join',{acceptRules:true,preference:'random'});assert.equal(joined.status,200);const call=joined.data.call;
 assert.equal(call.person.id,f.a.user.id);assert.equal((await f.a.request('/video/random/status')).data.call.id,call.id);
 assert.equal((await f.a.request(`/video/random/${call.id}/messages`,{body:'Hello from Random'})).status,200);
 assert.equal((await f.stranger.request(`/video/random/${call.id}/messages`)).data.messages[0].body,'Hello from Random');
 assert.equal((await f.b.request(`/video/random/${call.id}/messages`)).status,404);
 assert.equal((await f.a.request('/video/random/join',{acceptRules:true,preference:'invalid'})).status,400);
 assert.equal((await f.a.request('/video/random/status')).data.call.id,call.id);
 const a=await f.connect(f.a,call),b=await f.connect(f.stranger,call);
 a.ws.send(Buffer.concat([Buffer.from([1]),picture]));b.ws.send(Buffer.concat([Buffer.from([1]),picture]));
 await waitUntil(()=>a.records.some(x=>x.binary)&&b.records.some(x=>x.binary));
 await f.a.request('/blocks',{target:f.stranger.user.id});await waitUntil(()=>b.records.some(x=>x.type==='ended'));
 assert.equal((await f.a.request(`/video/random/${call.id}/messages`)).status,404);
});

test('a Random choice respects the other person’s opposite-gender choice in either queue order',async t=>{
 const f=await fixture(t);
 for(const [firstPreference,secondPreference]of [['opposite','random'],['random','opposite']]){
  await f.preflight(f.a);await f.preflight(f.stranger);
  assert.equal((await f.a.request('/video/random/join',{acceptRules:true,preference:firstPreference})).data.waiting,true);
  assert.equal((await f.stranger.request('/video/random/join',{acceptRules:true,preference:secondPreference})).data.waiting,true);
  assert.equal((await f.a.request('/video/random/status')).data.call,null);
  await f.a.request('/video/random/stop',{});await f.stranger.request('/video/random/stop',{});
 }
 await f.preflight(f.a);await f.preflight(f.b);
 await f.a.request('/video/random/join',{acceptRules:true,preference:'opposite'});
 const result=await f.b.request('/video/random/join',{acceptRules:true,preference:'random'});assert.equal(result.data.call.person.id,f.a.user.id);
});
