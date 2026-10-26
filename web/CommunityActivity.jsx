import React,{useEffect,useState} from 'react';
import {UsersRound} from 'lucide-react';
import {api} from './api';
import './community-activity.css';

export default function CommunityActivity({userId}){
 const [data,setData]=useState(null),[error,setError]=useState(false);
 useEffect(()=>{
  let cancelled=false,busy=false;setData(null);setError(false);
  async function refresh(){
   if(cancelled||busy||document.hidden)return;
   busy=true;
   try{const result=await api('/community/activity');if(!cancelled){setData(result);setError(false);}}
   catch{if(!cancelled){setData(null);setError(true);}}
   finally{busy=false;}
  }
  refresh();const timer=setInterval(refresh,15000);document.addEventListener('visibilitychange',refresh);
  return()=>{cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[userId]);
 const format=n=>new Intl.NumberFormat('en-IN').format(n);
 return <section className="community-activity" aria-label="Community activity"><div className="community-activity-title"><UsersRound size={18}/><div><strong>Active in the last 2 minutes</strong><small>Signed-in accounts · Declared gender · Updates every 15 seconds</small></div></div>{data?<div className="community-activity-counts"><span><strong>{format(data.total)}</strong> Total</span><span><strong>{format(data.men)}</strong> Men</span><span><strong>{format(data.women)}</strong> Women</span></div>:<p role="status">{error?'Activity count temporarily unavailable.':'Checking activity…'}</p>}</section>;
}
