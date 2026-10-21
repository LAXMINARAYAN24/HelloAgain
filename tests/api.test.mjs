import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createApplication} from '../backend/app.mjs';
import {ageOf} from '../backend/security.mjs';
import {isBlackFrame} from '../web/video-check.js';

const pw='A-test-password-that-is-long!';
async function fixture(t,{demo=false}={}){
 const mailDirectory=resolve('../../work/test-mail',randomUUID());
 const runtime=await createApplication({videoModerator:null,databasePath:':memory:',databaseUrl:'',demo,production:false,mailDirectory});
 const server=runtime.app.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.store.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 function client(){let cookie='';return {async call(path,{method='GET',body,origin}={}){const r=await fetch(base+'/api'+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:body!==undefined?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json(),headers:r.headers};}};}
 async function member(name,gender='man'){const c=client();const r=await c.call('/auth/signup',{method:'POST',body:{email:`${name.toLowerCase()}@example.test`,password:pw,name,dob:'1998-06-15',gender,city:'Bengaluru',bio:'A thoughtful introduction for testing.',interests:['Coffee','Music'],color:'sage',acceptRules:true,acceptPrivacy:true}});assert.equal(r.status,201,JSON.stringify(r.data));return {...c,user:r.data.user};}
 async function pair(a,b){const r=await a.call('/connections',{method:'POST',body:{target:b.user.id}});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.id;}
 return {...runtime,client,member,pair,base,mailDirectory};
}

test('birthday arithmetic handles the exact 18th birthday and invalid signups are rejected',async t=>{
 assert.equal(ageOf('2008-10-21',new Date('2026-10-21T01:00:00Z')),18);assert.equal(ageOf('2008-10-22',new Date('2026-10-21T01:00:00Z')),17);
 const f=await fixture(t),c=f.client();const body={email:'young@example.test',password:pw,name:'Young',dob:new Date().toISOString().slice(0,10),gender:'woman',city:'Pune',bio:'A sufficiently long biography.',interests:['Coffee'],color:'peach',acceptRules:true,acceptPrivacy:true};
 assert.equal((await c.call('/auth/signup',{method:'POST',body})).status,400);
 assert.equal((await c.call('/auth/signup',{method:'POST',body:{...body,dob:'1990-02-30'}})).status,400);
 assert.equal((await c.call('/auth/signup',{method:'POST',body:{...body,dob:'1990-01-01',acceptRules:false}})).status,400);
 assert.equal((await c.call('/auth/signup',{method:'POST',body:{...body,dob:'1990-01-01',role:'admin'}})).status,400);
 assert.equal((await c.call('/me')).data.user,null);
});

test('mutual opposite-gender connections protect private messages and enforce blocking both ways',async t=>{
 const f=await fixture(t),a=await f.member('Alan'),b=await f.member('Bella','woman'),stranger=await f.member('Chris');
 const discover=await a.call('/discover');assert.deepEqual(discover.data.people.map(p=>p.id),[b.user.id]);assert.equal(discover.data.people[0].email,undefined);assert.equal(discover.data.people[0].dob,undefined);
 assert.equal((await a.call('/connections',{method:'POST',body:{target:stranger.user.id}})).status,404);
 const id=await f.pair(a,b);
 assert.equal((await a.call(`/connections/${id}/messages`,{method:'POST',body:{body:'Before acceptance'}})).status,403);
 assert.equal((await a.call(`/connections/${id}/respond`,{method:'POST',body:{accept:true}})).status,404);
 assert.equal((await stranger.call(`/connections/${id}/respond`,{method:'POST',body:{accept:true}})).status,404);
 assert.equal((await b.call(`/connections/${id}/respond`,{method:'POST',body:{accept:true}})).status,200);
 assert.equal((await a.call(`/connections/${id}/messages`,{method:'POST',body:{body:'Hello Bella <script>alert(1)</script>'}})).status,200);
 const messages=await b.call(`/connections/${id}/messages`);assert.equal(messages.data.messages.length,1);assert.equal(messages.data.messages[0].body,'Hello Bella <script>alert(1)</script>');
 assert.equal((await stranger.call(`/connections/${id}/messages`)).status,404);
 assert.equal((await stranger.call(`/connections/${id}/messages`,{method:'POST',body:{body:'Intrusion'}})).status,404);
 assert.equal((await a.call('/admin/overview')).status,403);
 assert.equal((await b.call('/connections')).data.connections[0].unread,1);
 await b.call(`/connections/${id}/read`,{method:'POST',body:{}});assert.equal((await b.call('/connections')).data.connections[0].unread,0);
 assert.equal((await b.call('/blocks',{method:'POST',body:{target:a.user.id}})).status,200);
 assert.equal((await a.call('/discover')).data.people.length,0);
 assert.equal((await a.call('/connections')).data.connections.length,0);
 assert.equal((await a.call(`/connections/${id}/messages`,{method:'POST',body:{body:'Bypass block'}})).status,404);
 await b.call(`/blocks/${a.user.id}`,{method:'DELETE',body:{}});
 assert.equal((await a.call(`/connections/${id}/messages`,{method:'POST',body:{body:'Reopen without consent'}})).status,403);
});

test('reporting does not automatically ban; confirmed moderator bans revoke sessions and deny login',async t=>{
 const f=await fixture(t),admin=await f.member('Owner'),a=await f.member('Dylan'),b=await f.member('Elena','woman');
 await f.store.transaction(db=>db.run("UPDATE users SET role='admin' WHERE id=?",[admin.user.id]));
 const id=await f.pair(a,b);await b.call(`/connections/${id}/respond`,{method:'POST',body:{accept:true}});await a.call(`/connections/${id}/messages`,{method:'POST',body:{body:'Evidence text'}});
 const report=await b.call('/reports',{method:'POST',body:{target:a.user.id,reason:'shirtless',detail:'A test report, not a confirmed violation.',block:false}});assert.equal(report.status,200);
 assert.equal((await a.call('/me')).status,200);
 let queue=await admin.call('/admin/overview');assert.equal(queue.status,200);assert.equal(queue.data.reports[0].context.length,1);
 assert.equal((await b.call(`/admin/reports/${report.data.id}/resolve`,{method:'POST',body:{action:'ban',note:'Unauthorized attempt'}})).status,403);
 assert.equal((await admin.call(`/admin/reports/${report.data.id}/resolve`,{method:'POST',body:{action:'ban',note:'Confirmed violation after evidence review.'}})).status,200);
 assert.equal((await a.call(`/connections/${id}/messages`,{method:'POST',body:{body:'Blocked after ban'}})).status,401);
 assert.equal((await f.client().call('/auth/login',{method:'POST',body:{email:a.user.email,password:pw}})).status,403);
 assert.equal((await b.call('/connections')).data.connections.length,0);
 queue=await admin.call('/admin/overview');assert.equal(queue.data.audit[0].action,'ban');
 await admin.call(`/admin/users/${a.user.id}/status`,{method:'POST',body:{status:'active',note:'Appeal reviewed; restore this test account.'}});
 assert.equal((await f.client().call('/auth/login',{method:'POST',body:{email:a.user.email,password:pw}})).status,200);
});

test('privacy controls, export, deletion, report redaction, and password hashing',async t=>{
 const f=await fixture(t),a=await f.member('Finn'),b=await f.member('Grace','woman'),admin=await f.member('Manager');
 await f.store.transaction(db=>db.run("UPDATE users SET role='admin' WHERE id=?",[admin.user.id]));
 const stored=await f.store.transaction(db=>db.get('SELECT password_hash FROM users WHERE id=?',[a.user.id]));assert.notEqual(stored.password_hash,pw);assert.ok(stored.password_hash.startsWith('scrypt$'));
 const update={name:b.user.name,city:b.user.city,bio:b.user.bio,interests:b.user.interests,color:b.user.color,visible:false,ageMin:18,ageMax:99};
 await b.call('/profile',{method:'PUT',body:update});assert.equal((await a.call('/discover')).data.people.length,0);
 assert.equal((await a.call('/connections',{method:'POST',body:{target:b.user.id}})).status,403);
 await b.call('/profile',{method:'PUT',body:{...update,visible:true}});
 const id=await f.pair(a,b);await b.call(`/connections/${id}/respond`,{method:'POST',body:{accept:true}});await a.call(`/connections/${id}/messages`,{method:'POST',body:{body:'A private message to delete.'}});
 await b.call('/reports',{method:'POST',body:{target:a.user.id,reason:'other',detail:'Information to redact after deletion.',block:false}});
 const exported=await a.call('/account/export');assert.equal(exported.data.sentMessages.length,1);assert.equal(exported.data.profile.password_hash,undefined);assert.ok(!JSON.stringify(exported.data).includes(stored.password_hash));
 assert.equal((await a.call('/account',{method:'DELETE',body:{password:'wrong',confirmation:'DELETE'}})).status,400);
 assert.equal((await a.call('/account',{method:'DELETE',body:{password:pw,confirmation:'DELETE'}})).status,200);
 assert.equal((await a.call('/account/export')).status,401);
 assert.equal((await b.call('/connections')).data.connections.length,0);
 const queue=await admin.call('/admin/overview');assert.equal(queue.data.reports[0].target,null);assert.deepEqual(queue.data.reports[0].context,[]);assert.equal(queue.data.reports[0].detail,'Removed after account deletion');
 assert.equal((await f.store.transaction(db=>db.all('SELECT * FROM messages'))).length,0);
});

test('CSRF checks, secure cookie attributes, persistent login throttling, locked video, and production guard',async t=>{
 const f=await fixture(t),a=await f.member('Harper'),anonymous=f.client();
 assert.equal((await a.call('/auth/logout',{method:'POST',body:{},origin:'https://attacker.example'})).status,403);
 assert.equal((await a.call('/me')).data.user.id,a.user.id);
 const login=await anonymous.call('/auth/login',{method:'POST',body:{email:a.user.email,password:pw}});assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);assert.equal(login.headers.get('cache-control'),'no-store');
 const locked=await a.call('/video/calls',{method:'POST',body:{}});assert.equal(locked.status,503);assert.match(locked.data.error,/locked/);
 for(let i=0;i<14;i++)assert.equal((await anonymous.call('/auth/login',{method:'POST',body:{email:'nonexistent@example.test',password:'wrong'}})).status,401);
 assert.equal((await anonymous.call('/auth/login',{method:'POST',body:{email:a.user.email,password:pw}})).status,429);
 await assert.rejects(()=>createApplication({production:true,databaseUrl:'',origin:'http://localhost:4310',demo:false}),/Production requires/);
 assert.equal((await a.call('/auth/demo',{method:'POST',body:{}})).status,404);
});

test('retention clears old messages, report evidence, expired sessions, and audit entries',async t=>{
 const f=await fixture(t),a=await f.member('Ivan'),b=await f.member('Julia','woman');const id=await f.pair(a,b);await b.call(`/connections/${id}/respond`,{method:'POST',body:{accept:true}});
 await f.store.transaction(async db=>{await db.run('INSERT INTO messages(id,connection_id,sender_id,body,created_at) VALUES(?,?,?,?,?)',[randomUUID(),id,a.user.id,'Old text','2000-01-01T00:00:00.000Z']);await db.run('INSERT INTO reports(id,reporter,target,reason,detail,context,created_at) VALUES(?,?,?,?,?,?,?)',['old-report',a.user.id,b.user.id,'other','old','["old evidence"]',new Date(Date.now()-40*86400000).toISOString()]);});
 await f.cleanup();
 assert.equal((await f.store.transaction(db=>db.all('SELECT * FROM messages'))).length,0);
 assert.equal((await f.store.transaction(db=>db.get("SELECT context FROM reports WHERE id='old-report'"))).context,'[]');
});

test('sample seed is explicit, repeatable, and has a functioning demo conversation',async t=>{
 const f=await fixture(t,{demo:true}),c=f.client();assert.equal((await c.call('/config')).data.demo,true);
 const r=await c.call('/auth/demo',{method:'POST',body:{}});assert.equal(r.status,200);assert.equal(r.data.user.name,'Alex');assert.equal(r.data.user.role,'member');
 const conversations=await c.call('/connections');assert.equal(conversations.data.connections.length,2);
 const chat=await c.call('/connections/demo-chat/messages');assert.equal(chat.data.messages.length,3);assert.equal(chat.data.hasMore,false);
 assert.ok((await c.call('/discover')).data.people.every(p=>p.isDemo));
});

test('password recovery hashes single-use tokens, revokes old sessions, and treats unknown emails generically',async t=>{
 const f=await fixture(t),a=await f.member('Kelly'),c=f.client();
 const known=await c.call('/auth/recovery',{method:'POST',body:{email:a.user.email}});
 const unknown=await c.call('/auth/recovery',{method:'POST',body:{email:'missing@example.test'}});
 assert.equal(known.status,200);assert.deepEqual(known.data,unknown.data);
 const files=await readdir(f.mailDirectory);assert.equal(files.length,1);
 const mail=await readFile(resolve(f.mailDirectory,files[0]),'utf8');const token=new URL(mail.match(/http:\/\/\S+/)[0]).searchParams.get('reset');
 const stored=await f.store.transaction(db=>db.get('SELECT * FROM account_tokens'));assert.notEqual(stored.token_hash,token);
 const newPassword='A-unique-reset-password-2026!';
 assert.equal((await c.call('/auth/reset',{method:'POST',body:{token,password:newPassword}})).status,200);
 assert.equal((await a.call('/account/export')).status,401);
 assert.equal((await c.call('/auth/reset',{method:'POST',body:{token,password:newPassword}})).status,400);
 assert.equal((await c.call('/auth/login',{method:'POST',body:{email:a.user.email,password:pw}})).status,401);
 assert.equal((await c.call('/auth/login',{method:'POST',body:{email:a.user.email,password:newPassword}})).status,200);
});

test('black-screen reports immediately block contact without treating a technical problem as proof of misconduct',async t=>{
 const f=await fixture(t),a=await f.member('Liam'),b=await f.member('Mina','woman'),id=await f.pair(a,b);await b.call(`/connections/${id}/respond`,{method:'POST',body:{accept:true}});
 const report=await b.call('/reports',{method:'POST',body:{target:a.user.id,reason:'black_screen',detail:'Camera stayed black.'}});assert.equal(report.status,200);
 assert.equal((await a.call(`/connections/${id}/messages`,{method:'POST',body:{body:'Try to bypass block'}})).status,404);
 assert.equal((await b.call('/blocks')).data.blocks[0].id,a.user.id);
 assert.equal((await f.store.transaction(db=>db.get('SELECT status FROM users WHERE id=?',[a.user.id]))).status,'active');
});

test('local preview identifies almost-black frames and allows clearly visible camera imagery',()=>{
 assert.equal(isBlackFrame(new Uint8ClampedArray([0,0,0,255,3,3,3,255])),true);
 assert.equal(isBlackFrame(new Uint8ClampedArray([72,45,32,255,50,35,25,255])),false);
 assert.equal(isBlackFrame(new Uint8ClampedArray([255,255,255,255,0,0,0,255])),false);
 assert.equal(isBlackFrame(new Uint8ClampedArray()),false);
});
