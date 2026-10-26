import {post} from './api.js';

export function trafficSource(search,referrer){
 const campaign=new URLSearchParams(search).get('utm_source')?.toLowerCase();
 const aliases={ig:'instagram',instagram:'instagram',fb:'facebook',facebook:'facebook',yt:'youtube',youtube:'youtube',google:'google',member_share:'referral'};
 if(campaign)return aliases[campaign]||'other';
 try{
  const host=new URL(referrer).hostname.toLowerCase();
  const matches=domain=>host===domain||host.endsWith('.'+domain);
  for(const [domain,source] of [['instagram.com','instagram'],['facebook.com','facebook'],['youtube.com','youtube'],['youtu.be','youtube'],['google.com','google'],['google.co.in','google']])if(matches(domain))return source;
  return 'other';
 }catch{return 'direct';}
}

let recorded=false;
export function startTraffic(user){
 if(user?.canViewTraffic){try{localStorage.setItem('helloagain_owner_no_count','1');}catch{}return()=>{};}
 if(recorded||window.location.pathname!=='/'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return()=>{};
 try{if(localStorage.getItem('helloagain_owner_no_count')==='1')return()=>{};}catch{}
 let cancelled=false;
 async function record(){
  if(cancelled||recorded||document.hidden)return;
  recorded=true;
  // A new random ID per document load only deduplicates network retries; it is not a visitor ID.
  const payload={eventId:crypto.randomUUID(),source:trafficSource(window.location.search,document.referrer)};
  for(let attempt=0;attempt<2&&!cancelled;attempt++){
   try{await post('/traffic/pageview',payload);break;}catch{if(attempt===0)await new Promise(r=>setTimeout(r,1500));}
  }
 }
 record();document.addEventListener('visibilitychange',record);
 return()=>{cancelled=true;document.removeEventListener('visibilitychange',record);};
}
