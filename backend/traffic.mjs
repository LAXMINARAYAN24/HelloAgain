import { z } from 'zod';
import { fail, hashToken, limit } from './security.mjs';

const sources=['direct','instagram','facebook','youtube','google','other'];
const event=z.object({eventId:z.uuid(),source:z.enum(sources)}).strict();
export const trafficDay=(time=Date.now())=>new Date(time+19800000).toISOString().slice(0,10);
const dayAgo=(days,time=Date.now())=>trafficDay(time-days*86400000);

export function createTraffic({ownerEmail='',origin}){
 const owner=ownerEmail.trim().toLowerCase();
 const isOwner=user=>!!owner&&user?.email===owner&&user.status==='active';
 return {
  isOwner,
  async initialize(db){if(owner)await db.run('INSERT INTO traffic_meta(id,started_at,total_views) VALUES(1,?,0) ON CONFLICT(id) DO NOTHING',[new Date().toISOString()]);},
  async record(db,user,req){
   if(!owner)return {ok:true};
   if(req.get('Origin')!==origin)fail(403,'This request must come from this website.');
   const value=event.parse(req.body);
   if(isOwner(user)||req.get('DNT')==='1'||req.get('Sec-GPC')==='1'||/bot|crawler|spider|headless|preview|monitor|lighthouse/i.test(req.get('User-Agent')||''))return {ok:true};
   // Only a short-lived hash is used for abuse limiting; no IP is stored in traffic data.
   await limit(db,`traffic:${hashToken(`${trafficDay()}:${req.ip}`)}`,120,60000);
   const inserted=await db.run('INSERT INTO traffic_seen(event_id,created_at) VALUES(?,?) ON CONFLICT(event_id) DO NOTHING',[value.eventId,new Date().toISOString()]);
   if(inserted.changes){
    await db.run('UPDATE traffic_meta SET total_views=total_views+1 WHERE id=1');
    await db.run('INSERT INTO traffic_daily(day,source,views) VALUES(?,?,1) ON CONFLICT(day,source) DO UPDATE SET views=traffic_daily.views+1',[trafficDay(),value.source]);
   }
   return {ok:true};
  },
  async overview(db,user){
   if(!isOwner(user))fail(403,'Only the site owner can view traffic.');
   const meta=await db.get('SELECT started_at,total_views FROM traffic_meta WHERE id=1');
   const rows=await db.all('SELECT day,source,views FROM traffic_daily WHERE day>=? ORDER BY day',[dayAgo(89)]);
   const sum=since=>rows.filter(r=>r.day>=since).reduce((n,r)=>n+Number(r.views),0);
   return {startedAt:meta.started_at,updatedAt:new Date().toISOString(),timezone:'Asia/Kolkata',total:Number(meta.total_views),today:sum(dayAgo(0)),last7:sum(dayAgo(6)),last30:sum(dayAgo(29)),daily:Array.from({length:30},(_,i)=>{const day=dayAgo(29-i);return {day,tracked:day>=trafficDay(Date.parse(meta.started_at)),views:rows.filter(r=>r.day===day).reduce((n,r)=>n+Number(r.views),0)};}),sources:sources.map(source=>({source,views:rows.filter(r=>r.source===source&&r.day>=dayAgo(29)).reduce((n,r)=>n+Number(r.views),0)}))};
  },
  async cleanup(db){await db.run('DELETE FROM traffic_seen WHERE created_at<?',[new Date(Date.now()-86400000).toISOString()]);await db.run('DELETE FROM traffic_daily WHERE day<?',[dayAgo(89)]);}
 };
}
