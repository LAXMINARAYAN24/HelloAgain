import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export const now=()=>new Date().toISOString();
export const hashToken=t=>createHash('sha256').update(t).digest('hex');
export const newToken=()=>randomBytes(32).toString('base64url');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,{N:16384,r:8,p:1});return `scrypt$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password, stored){if(typeof password!=='string'||password.length>256)return false;const [kind,salt,key]=stored.split('$');if(kind!=='scrypt')return false;const derived=await scrypt(password,salt,64,{N:16384,r:8,p:1});const expected=Buffer.from(key,'hex');return expected.length===derived.length&&timingSafeEqual(expected,derived);}
export function ageOf(dob,reference=new Date()){const d=new Date(`${dob}T00:00:00Z`);let age=reference.getUTCFullYear()-d.getUTCFullYear();if(reference.getUTCMonth()<d.getUTCMonth()||(reference.getUTCMonth()===d.getUTCMonth()&&reference.getUTCDate()<d.getUTCDate()))age--;return age;}
export const INTERESTS=['Coffee','Music','Travel','Books','Food','Outdoors','Art','Movies','Fitness','Gaming','Photography','Dogs'];
export const COLORS=['peach','sage','lilac','sand','blue','rose'];
export function publicProfile(u){return {id:u.id,name:u.name,age:ageOf(u.dob),gender:u.gender,city:u.city,bio:u.bio,interests:JSON.parse(u.interests),color:u.color,isDemo:!!u.is_demo,recentlyActive:Date.now()-Date.parse(u.last_seen)<300000};}
export function ownProfile(u){return {...publicProfile(u),email:u.email,dob:u.dob,visible:!!u.visible,ageMin:u.age_min,ageMax:u.age_max,role:u.role,status:u.status,createdAt:u.created_at};}
export function fail(status,message){const e=new Error(message);e.status=status;throw e;}
export async function limit(db,key,max,windowMs){const time=Date.now();const row=await db.get('SELECT * FROM rate_limits WHERE key=?',[key]);if(row&&Number(row.reset_at)>time&&row.hits>=max)fail(429,'Please slow down and try again shortly.');if(!row||Number(row.reset_at)<=time)await db.run('INSERT INTO rate_limits(key,hits,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=1,reset_at=excluded.reset_at',[key,time+windowMs]);else await db.run('UPDATE rate_limits SET hits=hits+1 WHERE key=?',[key]);if(db.checkpoint)await db.checkpoint();}
