import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createApplication} from '../backend/app.mjs';
const origin='http://127.0.0.1:4314';
const runtime=await createApplication({databasePath:':memory:',databaseUrl:'',demo:false,production:false,origin});
assert.equal(runtime.video.ready(),true,'Run the video setup script before this test.');
const server=runtime.app.listen(4314,'127.0.0.1');runtime.video.attach(server);await once(server,'listening');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const errors=[];const contexts=[];
const password='Local-camera-test-password-2026!';
const image=readFileSync(new URL('./fixtures/clothed-camera.jpg',import.meta.url)).toString('base64');
try{
 for(const [name,gender]of [['Caller','man'],['Receiver','man'],['SecondCaller','woman'],['SecondReceiver','woman']]){
  const context=await browser.newContext({viewport:{width:1280,height:1000},permissions:['camera','microphone']});contexts.push(context);
  await context.addInitScript(({image})=>{
   window.testCameraMode='clear';window.testAudioPackets=0;
   const RealSocket=window.WebSocket;
   window.WebSocket=class extends RealSocket{constructor(...args){super(...args);this.addEventListener('message',event=>{if(event.data instanceof ArrayBuffer&&new Uint8Array(event.data)[0]===2)window.testAudioPackets++;});}};
   const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{
    if(!constraints.video)return original(constraints);
    const picture=new Image();picture.src='data:image/jpeg;base64,'+image;await picture.decode();
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;const ctx=canvas.getContext('2d');
    const paint=()=>{if(window.testCameraMode==='black'){ctx.fillStyle='black';ctx.fillRect(0,0,480,360);}else ctx.drawImage(picture,0,0,480,360);};paint();const timer=setInterval(paint,80);
    const result=canvas.captureStream(12);for(const track of result.getVideoTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}
    if(constraints.audio){const audio=await original({audio:constraints.audio});for(const track of audio.getAudioTracks())result.addTrack(track);}
    return result;
   };
  },{image});
  const response=await context.request.post(origin+'/api/auth/signup',{data:{email:`${name.toLowerCase()}@example.test`,password,name:`${name} test`,dob:'1998-01-01',gender,city:'Raipur',bio:'Isolated local camera testing account.',interests:['Music'],color:'sage',acceptRules:true,acceptPrivacy:true}});assert.equal(response.status(),201);
 }
 const pages=await Promise.all(contexts.map(context=>context.newPage()));const [a,b,c,d]=pages;for(const page of pages)page.on('pageerror',e=>errors.push(e.message));
 await Promise.all(pages.map(page=>page.goto(origin)));
 for(const [index,page]of pages.entries()){assert.deepEqual(await page.getByLabel('Who to meet').locator('option').allTextContents(),['Random (everyone)',index<2?'Women':'Men']);await page.getByRole('checkbox',{name:/I’m 18/}).check();}
 for(const pair of [[a,b],[c,d]]){await pair[0].getByRole('button',{name:'Start',exact:true}).click();await pair[1].getByRole('button',{name:'Start',exact:true}).click();await Promise.all(pair.map(page=>page.locator('.camera-top-label').filter({hasText:'Connected'}).waitFor({timeout:20000})));}
 await Promise.all(pages.map(page=>page.waitForFunction(()=>window.testAudioPackets>0)));
 const firstState=await (await contexts[0].request.get(origin+'/api/video/random/status')).json();
 assert.ok(firstState.call.random);
 await a.getByLabel('Your chat message').fill('Hello in the first random room.');await a.getByRole('button',{name:'Send chat message'}).click();await b.getByText('Hello in the first random room.',{exact:true}).waitFor();
 await a.getByRole('button',{name:'Next',exact:true}).click();await a.getByRole('heading',{name:/Looking for someone new/}).waitFor();assert.equal(await a.getByText('Hello in the first random room.',{exact:true}).count(),0);
 await b.getByText(/Your partner moved|other person disconnected/).waitFor({timeout:10000});
 await d.getByRole('button',{name:'Next',exact:true}).click();await Promise.all([a,d].map(page=>page.locator('.camera-top-label').filter({hasText:'Connected'}).waitFor({timeout:20000})));
 const secondState=await (await contexts[0].request.get(origin+'/api/video/random/status')).json();assert.notEqual(firstState.call.id,secondState.call.id);
 assert.equal((await contexts[0].request.get(origin+`/api/video/random/${firstState.call.id}/messages`)).status(),404);
 await d.getByLabel('Your chat message').fill('A fresh room after Next.');await d.getByRole('button',{name:'Send chat message'}).click();await a.getByText('A fresh room after Next.',{exact:true}).waitFor();
 await a.getByRole('button',{name:'Mute microphone',exact:true}).click();assert.equal(await a.getByRole('button',{name:'Unmute microphone',exact:true}).count(),1);await a.getByRole('button',{name:'Unmute microphone',exact:true}).click();
 const shots=new URL('../docs/screenshots/',import.meta.url);mkdirSync(shots,{recursive:true});await a.screenshot({path:fileURLToPath(new URL('live-call-test.png',shots)),fullPage:false});
 await d.setViewportSize({width:390,height:844});assert.ok(await d.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await d.screenshot({path:fileURLToPath(new URL('live-call-mobile-test.png',shots)),fullPage:false});
 await a.evaluate(()=>{window.testCameraMode='black';});await d.getByText(/clear camera picture was not received|Camera picture lost/).waitFor({timeout:12000});assert.equal((await contexts[0].request.get(origin+'/api/me')).status(),200);
 assert.deepEqual(errors,[]);
 console.log('PASS: four independent accounts connected two simultaneous same-gender Random video/audio calls; Next switched partners, cleared text and revoked the old room; fresh text, mute, mobile layout and black-camera cutoff worked. Cameras and microphones were synthetic.');
}catch(error){for(let i=0;i<contexts.length;i++){const page=contexts[i].pages()[0];if(page){console.error(`CLIENT ${i}:`,await page.locator('body').innerText());}}throw error;}
finally{await browser.close();runtime.video.finishAll();server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.close();}
