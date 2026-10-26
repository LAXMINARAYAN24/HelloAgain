import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../backend/app.mjs';
import {createTraffic,trafficDay} from '../backend/traffic.mjs';
import {trafficSource} from '../web/traffic.js';

async function setup(t,enabled=true){
 const runtime=await createApplication({databasePath:':memory:',databaseUrl:'',videoModerator:null,production:false,demo:false,origin:'http://localhost:4310',analyticsOwnerEmail:enabled?'owner@example.test':''});
 const server=runtime.app.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.close();});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const client=()=>{let cookie='';return {async call(path,{body,headers={}}={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:'http://localhost:4310'}:{}),Cookie:cookie,'User-Agent':'Traffic test browser',...headers},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json(),headers:r.headers};}};};
 const signup=async(name,gender='man')=>{const c=client();const r=await c.call('/auth/signup',{body:{email:name+'@example.test',password:'A-long-testing-password!',name,dob:'1990-01-01',gender,acceptRules:true,acceptPrivacy:true}});assert.equal(r.status,201);return {...c,user:r.body.user};};
 return {...runtime,client,signup};
}

test('only the configured owner can read traffic; roles and public endpoints do not disclose totals',async t=>{
 const f=await setup(t),anon=f.client(),owner=await f.signup('owner'),member=await f.signup('member'),admin=await f.signup('admin');
 await f.store.transaction(db=>db.run("UPDATE users SET role='admin' WHERE id=?",[admin.user.id]));
 assert.equal(owner.user.canViewTraffic,true);assert.equal(owner.user.role,'member');assert.equal(member.user.canViewTraffic,false);
 assert.equal((await anon.call('/owner/traffic')).status,401);
 assert.equal((await member.call('/owner/traffic')).status,403);assert.equal((await admin.call('/owner/traffic')).status,403);
 const event={eventId:randomUUID(),source:'instagram'};
 assert.deepEqual((await anon.call('/traffic/pageview',{body:event})).body,{ok:true});
 const data=await owner.call('/owner/traffic');assert.equal(data.status,200);assert.equal(data.body.total,1);assert.equal(data.body.today,1);assert.equal(data.body.sources.find(s=>s.source==='instagram').views,1);assert.equal(data.headers.get('cache-control'),'no-store');
 assert.equal((await anon.call('/config')).body.total,undefined);assert.equal((await anon.call('/config')).body.startedAt,undefined);
 assert.equal((await anon.call('/me')).body.user,null);
});

test('views deduplicate retries, ignore owner/privacy/bots, reject forged origins and excessive personal payload',async t=>{
 const f=await setup(t),anon=f.client(),owner=await f.signup('owner');
 const event={eventId:randomUUID(),source:'direct'};
 await anon.call('/traffic/pageview',{body:event});await anon.call('/traffic/pageview',{body:event});
 for(const headers of [{DNT:'1'},{'Sec-GPC':'1'},{'User-Agent':'Googlebot'},{'User-Agent':'HeadlessChrome'}])await anon.call('/traffic/pageview',{body:{...event,eventId:randomUUID()},headers});
 await owner.call('/traffic/pageview',{body:{...event,eventId:randomUUID()}});
 assert.equal((await anon.call('/traffic/pageview',{body:{...event,eventId:randomUUID()},headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await anon.call('/traffic/pageview',{body:event,headers:{Origin:''}})).status,403);
 assert.equal((await anon.call('/traffic/pageview',{body:{...event,source:'https://private.example/path?email=private'}})).status,400);
 assert.equal((await anon.call('/traffic/pageview',{body:{...event,email:'person@example.test'}})).status,400);
 assert.equal((await anon.call('/traffic/pageview',{body:{...event,eventId:'same-browser-id'}})).status,400);
 const stats=(await owner.call('/owner/traffic')).body;assert.equal(stats.total,1);assert.equal(stats.last7,1);assert.equal(stats.last30,1);
 const seen=await f.store.transaction(db=>db.all('SELECT * FROM traffic_seen'));assert.equal(seen.length,1);assert.deepEqual(Object.keys(seen[0]).sort(),['created_at','event_id']);
});

test('tracking begins once, uses IST boundaries and removes daily details without losing running total',async t=>{
 assert.equal(trafficDay(Date.parse('2026-10-25T18:29:59Z')),'2026-10-25');assert.equal(trafficDay(Date.parse('2026-10-25T18:30:00Z')),'2026-10-26');
 const f=await setup(t),owner=await f.signup('owner');const started=(await owner.call('/owner/traffic')).body.startedAt;
 await f.store.transaction(async db=>{await createTraffic({ownerEmail:'owner@example.test',origin:'http://localhost:4310'}).initialize(db);await db.run("INSERT INTO traffic_daily(day,source,views) VALUES('2020-01-01','direct',10)");await db.run("INSERT INTO traffic_seen(event_id,created_at) VALUES(?,'2020-01-01T00:00:00Z')",[randomUUID()]);await db.run('UPDATE traffic_meta SET total_views=10 WHERE id=1');});
 await f.cleanup();const data=(await owner.call('/owner/traffic')).body;
 assert.equal(data.startedAt,started);assert.equal(data.total,10);assert.equal(data.last30,0);assert.equal(data.daily.length,30);
 assert.equal((await f.store.transaction(db=>db.all('SELECT * FROM traffic_seen'))).length,0);assert.equal((await f.store.transaction(db=>db.all('SELECT * FROM traffic_daily'))).length,0);
});

test('disabled analytics collects nothing and source classification only emits bounded labels',async t=>{
 const f=await setup(t,false),anon=f.client(),owner=await f.signup('owner');assert.equal(owner.user.canViewTraffic,false);
 await anon.call('/traffic/pageview',{body:{eventId:randomUUID(),source:'instagram'}});
 assert.equal((await f.store.transaction(db=>db.all('SELECT * FROM traffic_meta'))).length,0);assert.equal((await f.store.transaction(db=>db.all('SELECT * FROM traffic_seen'))).length,0);
 assert.equal(trafficSource('?utm_source=IG',''),'instagram');assert.equal(trafficSource('?utm_source=member_share',''),'referral');assert.equal(trafficSource('?utm_source=anything-private',''),'other');assert.equal(trafficSource('','https://l.instagram.com/a?secret=1'),'instagram');assert.equal(trafficSource('','https://instagram.com.evil.example'),'other');assert.equal(trafficSource('',''),'direct');
});


test('regular members see only recent signed-in account aggregates by gender, with no duplicated sessions',async t=>{
 const f=await setup(t),anon=f.client(),man=await f.signup('member'),woman=await f.signup('woman','woman'),stale=await f.signup('stale','woman'),demo=await f.signup('sample'),banned=await f.signup('banned'),expired=await f.signup('expired');
 assert.equal((await anon.call('/community/activity')).status,401);
 await f.store.transaction(async db=>{
  await db.run('UPDATE users SET last_seen=? WHERE id=?',[new Date(Date.now()-121000).toISOString(),stale.user.id]);
  await db.run('UPDATE users SET is_demo=1 WHERE id=?',[demo.user.id]);
  await db.run("UPDATE users SET status='banned' WHERE id=?",[banned.user.id]);
  await db.run("UPDATE sessions SET expires_at='2020-01-01T00:00:00Z' WHERE user_id=?",[expired.user.id]);
  await db.run('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',[randomUUID(),woman.user.id,new Date(Date.now()+60000).toISOString(),new Date().toISOString()]);
 });
 const result=await man.call('/community/activity');assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
 assert.deepEqual(Object.keys(result.body).sort(),['men','total','updatedAt','windowSeconds','women']);
 assert.equal(result.body.total,2);assert.equal(result.body.men,1);assert.equal(result.body.women,1);assert.equal(result.body.windowSeconds,120);
 assert.equal(man.user.canViewTraffic,false);assert.equal((await man.call('/owner/traffic')).status,403);
 await woman.call('/auth/logout',{body:{}});
 // Another valid session still counts the same account once.
 assert.equal((await man.call('/community/activity')).body.total,2);
 await f.store.transaction(db=>db.run('DELETE FROM sessions WHERE user_id=?',[woman.user.id]));
 assert.equal((await man.call('/community/activity')).body.total,1);
 // Returning after inactivity makes this account active again.
 assert.equal((await stale.call('/community/activity')).body.total,2);
});
