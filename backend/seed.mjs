import { randomUUID } from 'node:crypto';
import { hashPassword, now } from './security.mjs';
export const DEMO_EMAIL='alex@helloagain.example';
export const DEMO_PASSWORD='Preview-only-hello-2026!';
export async function seedDemo(store){await store.transaction(async db=>{
 if(await db.get('SELECT id FROM users LIMIT 1'))return;
 const hash=await hashPassword(DEMO_PASSWORD);const time=now();
 const profiles=[
 ['alex','Alex','man','1999-04-12','Bengaluru','Collecting good coffee spots and even better stories. Usually planning my next little adventure.',['Coffee','Music','Travel'],'sage'],
 ['maya','Maya','woman','2000-06-18','Bengaluru','A good playlist, a long walk, and a conversation that goes somewhere unexpected.',['Music','Coffee','Art'],'peach'],
 ['isha','Isha','woman','1998-11-03','Bengaluru','Weekend trails and weekday daydreams. Tell me about the last place that surprised you.',['Outdoors','Travel','Photography'],'sage'],
 ['tara','Tara','woman','2001-03-22','Mumbai','Probably in a bookshop. Always up for a great film and an unnecessarily detailed review.',['Books','Movies','Coffee'],'lilac'],
 ['ria','Ria','woman','1999-08-10','Bengaluru','Here for easy conversation, new places, and people who are kind to the waiter.',['Food','Travel','Dogs'],'sand'],
 ['zoya','Zoya','woman','1997-02-14','Hyderabad','Making art, trying new recipes, and finding a reason to laugh every single day.',['Art','Food','Music'],'blue'],
 ['neha','Neha','woman','2000-12-01','Pune','Morning runs. Evening movies. A soft spot for terrible puns and very good dogs.',['Fitness','Movies','Dogs'],'rose'],
 ['dev','Dev','man','1997-05-09','Mumbai','Food walks and live music. Looking for someone who has a favourite breakfast place.',['Food','Music','Travel'],'sand'],
 ['arjun','Arjun','man','1998-01-25','Bengaluru','A quiet reader with a surprisingly competitive board-game side.',['Books','Gaming','Coffee'],'blue']
 ];
 for(const [id,name,gender,dob,city,bio,interests,color]of profiles)await db.run('INSERT INTO users(id,email,password_hash,name,dob,gender,city,bio,interests,color,is_demo,consent_version,created_at,last_seen) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?)',[id,`${id}@helloagain.example`,hash,name,dob,gender,city,bio,JSON.stringify(interests),color,'2026-10-21',time,time]);
 await db.run("INSERT INTO connections(id,user_a,user_b,requester,status,created_at,updated_at,read_a,read_b) VALUES('demo-chat','alex','maya','alex','accepted',?,?,?,?)",[time,time,time,time]);
 // Distinct, ordered times support deterministic chat pagination and read receipts.
 const base=Date.now()-3600000;
 for(const [i,[sender,body]]of [['alex','Hey Maya! Your playlist comment made me curious. What’s on repeat lately?'],['maya','A little indie, a little old-school soul. The perfect soundtrack for a slow Sunday.'],['maya','What about you — coffee first, or music first?']].entries())await db.run('INSERT INTO messages(id,connection_id,sender_id,body,created_at) VALUES(?,?,?,?,?)',[randomUUID(),'demo-chat',sender,body,new Date(base+i*1000).toISOString()]);
 await db.run("INSERT INTO connections(id,user_a,user_b,requester,status,created_at,updated_at,read_a,read_b) VALUES('demo-invite','alex','isha','isha','pending',?,?,?,?)",[time,time,time,time]);
 });}
