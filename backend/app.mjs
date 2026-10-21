import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createMailer } from './mail.mjs';
import { createModerator } from './moderator.mjs';
import { createVideoService } from './video-service.mjs';
import { now, hashPassword, verifyPassword, hashToken, newToken, ageOf, ownProfile, publicProfile, fail, limit, INTERESTS, COLORS } from './security.mjs';
import { openDatabase } from './database.mjs';
 import { seedDemo, DEMO_EMAIL } from './seed.mjs';

const consent='2026-10-21';
const text=(min,max)=>z.string().trim().min(min).max(max);
const email=z.email().max(254).transform(v=>v.toLowerCase());
const password=z.string().min(12,'Use at least 12 characters.').max(256);
const interests=z.array(z.enum(INTERESTS)).max(6).transform(v=>[...new Set(v)]);
const profileFields={name:text(2,40),city:text(0,60),bio:text(0,500),interests,color:z.enum(COLORS)};
const signup=z.object({...profileFields,city:profileFields.city.default(''),bio:profileFields.bio.default(''),interests:interests.default([]),color:z.enum(COLORS).default('sage'),email,password,dob:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),gender:z.enum(['man','woman']),acceptRules:z.literal(true),acceptPrivacy:z.literal(true)}).strict();
const profileUpdate=z.object({...profileFields,visible:z.boolean(),ageMin:z.number().int().min(18).max(99),ageMax:z.number().int().min(18).max(99)}).strict().refine(v=>v.ageMax>=v.ageMin,'Maximum age must be at least minimum age.');
const reportSchema=z.object({target:text(1,100),reason:z.enum(['black_screen','nudity','shirtless','sexual_activity','harassment','spam','underage','impersonation','other']),detail:z.string().trim().max(2000).default(''),block:z.boolean().default(true)}).strict();

export async function createApplication(options={}){
 const production=options.production??process.env.NODE_ENV==='production';
 const origin=options.origin??process.env.APP_ORIGIN??'http://localhost:4310';
 const databaseUrl=options.databaseUrl??process.env.DATABASE_URL;
 if(production&&(!origin.startsWith('https://')||!databaseUrl||process.env.DEMO_MODE==='true'))throw new Error('Production requires HTTPS APP_ORIGIN, DATABASE_URL, and DEMO_MODE=false.');
 const mailer=createMailer({production,origin,mailDirectory:options.mailDirectory});
 const store=await openDatabase({path:options.databasePath??process.env.SQLITE_PATH,url:databaseUrl,caPath:process.env.PG_CA_CERT_PATH});
 const demo=!production&&store.kind==='sqlite'&&(options.demo??process.env.DEMO_MODE==='true');
 if(demo)await seedDemo(store);
 const app=express();
 app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],connectSrc:["'self'",origin.replace(/^http/,'ws')],fontSrc:["'self'"],mediaSrc:["'self'",'blob:'],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:production?[]:null}},strictTransportSecurity:production?undefined:false}));
 app.use((_req,res,next)=>{res.set('Permissions-Policy','camera=(self), microphone=(self), geolocation=()');next();});
 app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/api/video/preflight',express.json({limit:'170kb'}));
 app.use(express.json({limit:'20kb'}));
 app.use('/api',(req,_res,next)=>{
   if(!['GET','HEAD','OPTIONS'].includes(req.method)){
     const received=req.get('Origin');
     const allowed=production?[origin]:[origin,'http://localhost:4310','http://127.0.0.1:4310','http://127.0.0.1:4311','http://localhost:4311'];
     if(received&&!allowed.includes(received))return next(Object.assign(new Error('This request did not originate from this website.'),{status:403}));
     if(req.get('Sec-Fetch-Site')==='cross-site')return next(Object.assign(new Error('Cross-site requests are not allowed.'),{status:403}));
     if(!req.is('application/json'))return next(Object.assign(new Error('Send application/json.'),{status:415}));
   }next();
 });
 const cookieToken=req=>{const raw=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('helloagain_session='));return raw?raw.slice('helloagain_session='.length):null;};
 const cookie=(res,token)=>res.cookie('helloagain_session',token,{httpOnly:true,sameSite:'strict',secure:production,maxAge:7*86400000,path:'/'});
 const clearCookie=res=>res.clearCookie('helloagain_session',{httpOnly:true,sameSite:'strict',secure:production,path:'/'});
 async function session(db,req,required=true){const token=cookieToken(req);if(!token){if(required)fail(401,'Please sign in to continue.');return null;}
   const u=await db.get('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',[hashToken(token),now()]);
   if(!u){if(required)fail(401,'Your session has ended. Please sign in again.');return null;}
   if(u.status!=='active')fail(403,`Your account is ${u.status}. Contact the operator to appeal.`);
   if(Date.now()-Date.parse(u.last_seen)>60000)await db.run('UPDATE users SET last_seen=? WHERE id=?',[now(),u.id]);return u;
 }
 async function issueSession(db,user,res){const token=newToken();await db.run('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',[hashToken(token),user.id,new Date(Date.now()+7*86400000).toISOString(),now()]);cookie(res,token);}
 const route=(method,path,handler,{auth=true,admin=false}={})=>app[method](path,async(req,res,next)=>{try{
   let result;await store.transaction(async db=>{
     const u=await session(db,req,auth);if(admin&&u?.role!=='admin')fail(403,'Administrator access required.');
     // Rate limits commit even when a handler fails (e.g. incorrect password).
     await db.run('SAVEPOINT request_changes');
     const scoped={...db,checkpoint:async()=>{await db.run('RELEASE SAVEPOINT request_changes');await db.run('SAVEPOINT request_changes');}};
     try{result={body:await handler(scoped,u,req,res)};}catch(e){await db.run('ROLLBACK TO SAVEPOINT request_changes');result={error:e};}
     await db.run('RELEASE SAVEPOINT request_changes');
   });if(result.error)throw result.error;if(!res.headersSent)res.json(result.body??{ok:true});
 }catch(e){next(e);}});
 const blocked=async(db,a,b)=>!!await db.get('SELECT blocker FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)',[a,b,b,a]);
 async function eligible(db,u,target,{allowSameGender=false}={}){const other=await db.get('SELECT * FROM users WHERE id=?',[target]);if(!other||other.id===u.id||other.status!=='active'||(!allowSameGender&&other.gender===u.gender)||await blocked(db,u.id,target))fail(404,'This person is not available.');return other;}
 async function connection(db,u,id,options={}){const c=await db.get('SELECT * FROM connections WHERE id=? AND (user_a=? OR user_b=?)',[id,u.id,u.id]);if(!c)fail(404,'Conversation not found.');const other=await eligible(db,u,c.user_a===u.id?c.user_b:c.user_a,options);if(c.status!=='accepted')fail(403,'Both people must accept before chatting.');return {c,other};}
 async function audit(db,actor,target,action,note){await db.run('INSERT INTO audit(id,actor,target,action,note,created_at) VALUES(?,?,?,?,?,?)',[randomUUID(),actor,target,action,note,now()]);}
 async function blockUser(db,a,b){await db.run('INSERT INTO blocks(blocker,blocked,created_at) VALUES(?,?,?) ON CONFLICT(blocker,blocked) DO NOTHING',[a,b,now()]);await db.run("UPDATE connections SET status='closed',updated_at=? WHERE (user_a=? AND user_b=?) OR (user_a=? AND user_b=?)",[now(),a,b,b,a]);video.endBetweenUsers(a,b);}

 const moderator=options.videoModerator!==undefined?options.videoModerator:process.env.VIDEO_ENABLED==='false'?null:await createModerator();
 const video=createVideoService({store,moderator,authenticate:session,connection,allowedOrigins:production?[origin]:[origin,'http://localhost:4310','http://127.0.0.1:4310','http://127.0.0.1:4311','http://localhost:4311']});

 route('get','/api/config',async()=>({brand:'HelloAgain',demo,videoEnabled:video.ready(),videoReason:video.ready()?'Random live calls are available after both adults press Start. Each transmitted picture is screened on this server.':'Live video is locked because camera screening is unavailable.',interests:INTERESTS,colors:COLORS,consentVersion:consent}),{auth:false});
 app.get('/api/health',(_req,res)=>res.json({ok:true}));
 route('get','/api/me',async(_db,u)=>({user:u?ownProfile(u):null}),{auth:false});
 route('post','/api/auth/signup',async(db,_u,req,res)=>{
   await limit(db,`signup:${req.ip}`,8,3600000);const v=signup.parse(req.body);const d=new Date(`${v.dob}T00:00:00Z`);const age=ageOf(v.dob);
   if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v.dob||age<18||age>99)fail(400,'You must be between 18 and 99 years old to join.');
   if(await db.get('SELECT id FROM users WHERE email=?',[v.email]))fail(409,'This email cannot be used. Try signing in.');
   const id=randomUUID(),time=now();const hash=await hashPassword(v.password);
   await db.run('INSERT INTO users(id,email,password_hash,name,dob,gender,city,bio,interests,color,consent_version,created_at,last_seen) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,v.email,hash,v.name,v.dob,v.gender,v.city,v.bio,JSON.stringify(v.interests),v.color,consent,time,time]);
   const u=await db.get('SELECT * FROM users WHERE id=?',[id]);await issueSession(db,u,res);res.status(201);return {user:ownProfile(u)};
 },{auth:false});
 route('post','/api/auth/login',async(db,_u,req,res)=>{
   await limit(db,`login:${req.ip}`,15,900000);const v=z.object({email,password:z.string().max(256)}).parse(req.body);await limit(db,`login-email:${hashToken(v.email)}`,15,900000);
   const u=await db.get('SELECT * FROM users WHERE email=?',[v.email]);
   // Equal-cost password work for unknown accounts.
   const fallback='scrypt$00000000000000000000000000000000$'+'00'.repeat(64);
   const valid=await verifyPassword(v.password,u?.password_hash??fallback);if(!u||!valid)fail(401,'Email or password is incorrect.');
   if(u.status!=='active')fail(403,`Your account is ${u.status}. Contact the operator to appeal.`);
   await issueSession(db,u,res);return {user:ownProfile(u)};
 },{auth:false});
 route('post','/api/auth/demo',async(db,_u,_req,res)=>{if(!demo)fail(404,'Demo is unavailable.');const u=await db.get('SELECT * FROM users WHERE email=?',[DEMO_EMAIL]);if(!u||u.status!=='active')fail(403,'Demo account is unavailable.');await issueSession(db,u,res);return {user:ownProfile(u)};},{auth:false});
 route('post','/api/auth/logout',async(db,_u,req,res)=>{const token=cookieToken(req);if(token)await db.run('DELETE FROM sessions WHERE token_hash=?',[hashToken(token)]);if(_u)video.endForUser(_u.id,'Signed out.');clearCookie(res);},{auth:false});
 route('post','/api/auth/recovery',async(db,_u,req)=>{await limit(db,`recovery:${req.ip}`,5,3600000);const address=email.parse(req.body.email);const u=await db.get("SELECT id FROM users WHERE email=? AND status='active'",[address]);if(u){const token=newToken();await db.run('INSERT INTO account_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',[hashToken(token),u.id,new Date(Date.now()+1800000).toISOString(),now()]);try{await mailer.reset(address,token);}catch{await db.run('DELETE FROM account_tokens WHERE token_hash=?',[hashToken(token)]);console.error('Recovery email delivery failed. Check the mail provider configuration.');}}
 return {message:mailer.mode==='local'?'If an active account exists, its reset email is saved in the server’s data/mail folder for this local preview.':'If an active account exists, a reset link has been sent. Check your email.'};},{auth:false});
 route('post','/api/auth/reset',async(db,_u,req,res)=>{await limit(db,`reset:${req.ip}`,10,900000);const v=z.object({token:text(20,200),password}).strict().parse(req.body);const row=await db.get("SELECT t.user_id FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at>? AND u.status='active'",[hashToken(v.token),now()]);if(!row)fail(400,'This reset link is invalid or expired. Request a new one.');await db.run('UPDATE users SET password_hash=? WHERE id=?',[await hashPassword(v.password),row.user_id]);await db.run('DELETE FROM account_tokens WHERE user_id=?',[row.user_id]);await db.run('DELETE FROM sessions WHERE user_id=?',[row.user_id]);video.endForUser(row.user_id,'Password changed.');clearCookie(res);return {ok:true};},{auth:false});
 route('put','/api/profile',async(db,u,req)=>{const v=profileUpdate.parse(req.body);await db.run('UPDATE users SET name=?,city=?,bio=?,interests=?,color=?,visible=?,age_min=?,age_max=? WHERE id=?',[v.name,v.city,v.bio,JSON.stringify(v.interests),v.color,Number(v.visible),v.ageMin,v.ageMax,u.id]);return {user:ownProfile(await db.get('SELECT * FROM users WHERE id=?',[u.id]))};});
 route('get','/api/discover',async(db,u,req)=>{
   const candidates=await db.all("SELECT * FROM users WHERE gender<>? AND id<>? AND visible=1 AND status='active' ORDER BY created_at DESC LIMIT 500",[u.gender,u.id]);
   const relations=await db.all('SELECT * FROM connections WHERE user_a=? OR user_b=?',[u.id,u.id]);const allBlocks=await db.all('SELECT * FROM blocks WHERE blocker=? OR blocked=?',[u.id,u.id]);const hidden=new Set(allBlocks.map(b=>b.blocker===u.id?b.blocked:b.blocker));
   const people=candidates.filter(p=>!hidden.has(p.id)&&ageOf(p.dob)>=u.age_min&&ageOf(p.dob)<=u.age_max&&ageOf(u.dob)>=p.age_min&&ageOf(u.dob)<=p.age_max).map(p=>{const c=relations.find(c=>c.user_a===p.id||c.user_b===p.id);return {...publicProfile(p),connectionStatus:c?.status??null,connectionId:c?.id??null,incoming:c?.status==='pending'&&c.requester!==u.id};});
   return {people};
 });
 route('post','/api/connections',async(db,u,req)=>{await limit(db,`invite:${u.id}`,20,3600000);const {target}=z.object({target:text(1,100)}).strict().parse(req.body);const other=await eligible(db,u,target);if(!other.visible||ageOf(other.dob)<u.age_min||ageOf(other.dob)>u.age_max||ageOf(u.dob)<other.age_min||ageOf(u.dob)>other.age_max)fail(403,'Your matching preferences do not overlap.');
   const [a,b]=[u.id,target].sort();const existing=await db.get('SELECT * FROM connections WHERE user_a=? AND user_b=?',[a,b]);if(existing)fail(409,'An invitation already exists for this connection.');
   const id=randomUUID(),time=now();await db.run("INSERT INTO connections(id,user_a,user_b,requester,status,created_at,updated_at,read_a,read_b) VALUES(?,?,?,?,'pending',?,?,?,?)",[id,a,b,u.id,time,time,time,time]);return {id};
 });
 route('get','/api/connections',async(db,u)=>{
   const rows=await db.all("SELECT * FROM connections WHERE (user_a=? OR user_b=?) AND status IN ('pending','accepted') ORDER BY updated_at DESC",[u.id,u.id]);const connections=[];
   for(const c of rows){const other=await db.get("SELECT * FROM users WHERE id=? AND status='active'",[c.user_a===u.id?c.user_b:c.user_a]);if(!other||await blocked(db,u.id,other.id))continue;const last=await db.get('SELECT body,created_at,sender_id FROM messages WHERE connection_id=? ORDER BY created_at DESC,id DESC LIMIT 1',[c.id]);const unread=await db.get('SELECT COUNT(*) AS total FROM messages WHERE connection_id=? AND sender_id<>? AND created_at>?',[c.id,u.id,c.user_a===u.id?c.read_a:c.read_b]);connections.push({id:c.id,status:c.status,incoming:c.requester!==u.id,person:publicProfile(other),lastMessage:last??null,unread:Number(unread.total),updatedAt:c.updated_at});}
   return {connections};
 });
 route('post','/api/connections/:id/respond',async(db,u,req)=>{const {accept}=z.object({accept:z.boolean()}).strict().parse(req.body);const c=await db.get('SELECT * FROM connections WHERE id=? AND (user_a=? OR user_b=?)',[req.params.id,u.id,u.id]);if(!c||c.requester===u.id||c.status!=='pending')fail(404,'Invitation not found.');await eligible(db,u,c.requester);await db.run('UPDATE connections SET status=?,updated_at=? WHERE id=?',[accept?'accepted':'declined',now(),c.id]);});
 route('post','/api/connections/:id/close',async(db,u,req)=>{await connection(db,u,req.params.id);await db.run("UPDATE connections SET status='closed',updated_at=? WHERE id=?",[now(),req.params.id]);video.endForUser(u.id,'Connection ended.');});
 route('get','/api/connections/:id/messages',async(db,u,req)=>{await connection(db,u,req.params.id);const before=req.query.before?String(req.query.before):null;let rows;
   if(before){const m=await db.get('SELECT created_at,id FROM messages WHERE id=? AND connection_id=?',[before,req.params.id]);if(!m)fail(400,'Invalid page cursor.');rows=await db.all('SELECT * FROM messages WHERE connection_id=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 51',[req.params.id,m.created_at,m.created_at,m.id]);}
   else rows=await db.all('SELECT * FROM messages WHERE connection_id=? ORDER BY created_at DESC,id DESC LIMIT 51',[req.params.id]);
   return {messages:rows.slice(0,50).reverse().map(m=>({id:m.id,body:m.body,senderId:m.sender_id,createdAt:m.created_at})),hasMore:rows.length>50};
 });
 route('post','/api/connections/:id/read',async(db,u,req)=>{const {c}=await connection(db,u,req.params.id);await db.run(`UPDATE connections SET ${c.user_a===u.id?'read_a':'read_b'}=? WHERE id=?`,[now(),c.id]);});
 route('post','/api/connections/:id/messages',async(db,u,req)=>{const {c}=await connection(db,u,req.params.id);await limit(db,`message:${u.id}`,30,60000);const {body}=z.object({body:text(1,4000)}).strict().parse(req.body);const id=randomUUID(),time=now();await db.run('INSERT INTO messages(id,connection_id,sender_id,body,created_at) VALUES(?,?,?,?,?)',[id,c.id,u.id,body,time]);await db.run('UPDATE connections SET updated_at=? WHERE id=?',[time,c.id]);return {message:{id,body,senderId:u.id,createdAt:time}};});
 route('post','/api/blocks',async(db,u,req)=>{const {target}=z.object({target:text(1,100)}).strict().parse(req.body);if(target===u.id||!await db.get('SELECT id FROM users WHERE id=?',[target]))fail(404,'Person not found.');await blockUser(db,u.id,target);});
 route('get','/api/blocks',async(db,u)=>({blocks:(await db.all('SELECT u.id,u.name,b.created_at FROM blocks b JOIN users u ON b.blocked=u.id WHERE b.blocker=?',[u.id]))}));
 route('delete','/api/blocks/:id',async(db,u,req)=>{await db.run('DELETE FROM blocks WHERE blocker=? AND blocked=?',[u.id,req.params.id]);});
 route('post','/api/reports',async(db,u,req)=>{await limit(db,`report:${u.id}`,10,3600000);const v=reportSchema.parse(req.body);if(v.target===u.id||!await db.get('SELECT id FROM users WHERE id=?',[v.target]))fail(404,'Person not found.');
   const c=await db.get('SELECT * FROM connections WHERE (user_a=? AND user_b=?) OR (user_a=? AND user_b=?)',[u.id,v.target,v.target,u.id]);const evidence=c?await db.all('SELECT sender_id,body,created_at FROM messages WHERE connection_id=? ORDER BY created_at DESC,id DESC LIMIT 10',[c.id]):[];
   const id=randomUUID();await db.run('INSERT INTO reports(id,reporter,target,reason,detail,context,created_at) VALUES(?,?,?,?,?,?,?)',[id,u.id,v.target,v.reason,v.detail,JSON.stringify(evidence),now()]);if(v.block)await blockUser(db,u.id,v.target);return {id};
 });
 route('get','/api/account/export',async(db,u)=>({exportedAt:now(),profile:ownProfile(u),connections:await db.all('SELECT * FROM connections WHERE user_a=? OR user_b=?',[u.id,u.id]),sentMessages:await db.all('SELECT * FROM messages WHERE sender_id=?',[u.id]),blocks:await db.all('SELECT * FROM blocks WHERE blocker=?',[u.id]),reports:await db.all('SELECT id,target,reason,detail,status,created_at FROM reports WHERE reporter=?',[u.id])}));
 route('delete','/api/account',async(db,u,req,res)=>{const v=z.object({password:z.string().max(256),confirmation:z.literal('DELETE')}).strict().parse(req.body);await limit(db,`delete:${u.id}`,5,900000);if(!await verifyPassword(v.password,u.password_hash))fail(400,'Your password is incorrect.');await db.run('DELETE FROM sessions WHERE user_id=?',[u.id]);await db.run("UPDATE reports SET context='[]',detail='Removed after account deletion' WHERE reporter=? OR target=?",[u.id,u.id]);await db.run("UPDATE audit SET note='Removed after account deletion' WHERE actor=? OR target=?",[u.id,u.id]);video.endForUser(u.id,'Account deleted.');await db.run('DELETE FROM users WHERE id=?',[u.id]);await mailer.purge(u.email);clearCookie(res);});
 route('post','/api/video/preflight',(db,u,req)=>video.preflight(db,u,req));
 route('get','/api/video/status',(db,u)=>video.status(db,u));
 route('post','/api/video/calls',(db,u,req)=>video.start(db,u,req));
 route('post','/api/video/calls/:id/respond',(db,u,req)=>video.respond(db,u,req));
 route('post','/api/video/calls/:id/end',(db,u,req)=>video.end(db,u,req));
 route('post','/api/video/random/join',(db,u,req)=>video.randomJoin(db,u,req));
 route('get','/api/video/random/status',(db,u)=>video.randomStatus(db,u));
 route('post','/api/video/random/stop',(db,u)=>video.randomStop(db,u));
 route('get','/api/video/random/:id/messages',(db,u,req)=>video.randomMessages(db,u,req));
 route('post','/api/video/random/:id/messages',(db,u,req)=>video.randomMessages(db,u,req,true));
 route('get','/api/admin/overview',async(db)=>({reports:(await db.all('SELECT r.*,a.name AS reporter_name,b.name AS target_name,b.status AS target_status FROM reports r LEFT JOIN users a ON a.id=r.reporter LEFT JOIN users b ON b.id=r.target ORDER BY r.created_at DESC LIMIT 100')).map(r=>({...r,context:JSON.parse(r.context)})),users:(await db.all('SELECT * FROM users ORDER BY created_at DESC LIMIT 200')).map(u=>({...ownProfile(u),statusReason:u.status_reason})),audit:await db.all('SELECT a.*,u.name AS actor_name,t.name AS target_name FROM audit a LEFT JOIN users u ON u.id=a.actor LEFT JOIN users t ON t.id=a.target ORDER BY a.created_at DESC LIMIT 100')}),{admin:true});
 route('post','/api/admin/reports/:id/resolve',async(db,u,req)=>{const v=z.object({action:z.enum(['ban','suspend','dismiss']),note:text(5,500)}).strict().parse(req.body);const r=await db.get("SELECT * FROM reports WHERE id=? AND status='open'",[req.params.id]);if(!r)fail(404,'Open report not found.');if(v.action!=='dismiss'){if(!r.target||r.target===u.id)fail(400,'This account cannot be moderated here.');await db.run('UPDATE users SET status=?,status_reason=? WHERE id=?',[v.action==='ban'?'banned':'suspended',v.note,r.target]);await db.run('DELETE FROM sessions WHERE user_id=?',[r.target]);video.endForUser(r.target,'Account access removed.');}await db.run('UPDATE reports SET status=?,action=?,resolved_at=? WHERE id=?',[v.action==='dismiss'?'dismissed':'resolved',v.action,now(),r.id]);await audit(db,u.id,r.target,v.action,v.note);},{admin:true});
 route('post','/api/admin/users/:id/status',async(db,u,req)=>{const v=z.object({status:z.enum(['active','suspended','banned']),note:text(5,500)}).strict().parse(req.body);if(req.params.id===u.id)fail(400,'You cannot change your own status.');const target=await db.get('SELECT id FROM users WHERE id=?',[req.params.id]);if(!target)fail(404,'Account not found.');await db.run('UPDATE users SET status=?,status_reason=? WHERE id=?',[v.status,v.note,target.id]);await db.run('DELETE FROM sessions WHERE user_id=?',[target.id]);video.endForUser(target.id,'Account access changed.');await audit(db,u.id,target.id,v.status==='active'?'restore':v.status,v.note);},{admin:true});
 app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
 // Retired demonstration URLs must not fall back to the real application.
 app.use('/call-lab',(_req,res)=>res.sendStatus(404));
 const dist=resolve('dist');if(existsSync(dist)){app.use(express.static(dist,{index:false}));app.get('/{*path}',(req,res)=>{if(req.path.includes('.'))return res.sendStatus(404);res.set('Cache-Control','no-cache').sendFile(resolve(dist,'index.html'));});}
 app.use((err,_req,res,_next)=>{if(res.headersSent)return;const status=err.status??(err instanceof z.ZodError?400:500);if(status===500)console.error('Request failed:',err.message);const message=err instanceof z.ZodError?err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(' · '):status>=500&&!err.status?'This service is unavailable. Please try again later.':err.message;res.status(status).json({error:message});});
 async function cleanup(){await mailer.purge();return store.transaction(async db=>{await db.run('DELETE FROM sessions WHERE expires_at<?',[now()]);await db.run('DELETE FROM account_tokens WHERE expires_at<?',[now()]);await db.run('DELETE FROM rate_limits WHERE reset_at<?',[Date.now()]);await db.run('DELETE FROM messages WHERE created_at<?',[new Date(Date.now()-90*86400000).toISOString()]);await db.run("UPDATE reports SET context='[]' WHERE created_at<?",[new Date(Date.now()-30*86400000).toISOString()]);await db.run('DELETE FROM reports WHERE created_at<?',[new Date(Date.now()-90*86400000).toISOString()]);await db.run('DELETE FROM audit WHERE created_at<?',[new Date(Date.now()-90*86400000).toISOString()]);await db.run('DELETE FROM random_rooms WHERE ended_at<?',[new Date(Date.now()-90*86400000).toISOString()]);});}
 await store.transaction(async db=>{await db.run("UPDATE connections SET status='closed',updated_at=? WHERE id IN (SELECT connection_id FROM random_rooms WHERE ended_at IS NULL)",[now()]);await db.run('UPDATE random_rooms SET ended_at=? WHERE ended_at IS NULL',[now()]);});
 await cleanup();
 return {app,store,cleanup,demo,video,close:async()=>{await video.close();await store.close();}};
}
