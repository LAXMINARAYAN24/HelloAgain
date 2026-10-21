export async function captureCameraFrame(video){
 const deadline=Date.now()+4000;
 while(!video?.videoWidth||video.readyState<2){if(Date.now()>deadline)throw new Error('Your camera picture did not arrive. Check your camera and try again.');await new Promise(r=>setTimeout(r,60));}
 const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;
 canvas.getContext('2d').drawImage(video,0,0,480,360);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Camera picture could not be read.')),'image/jpeg',.72));
}

export async function startMediaRelay({callId,stream,localVideo,remoteCanvas,audioContext,onRemote,onWarning,onEnd}){
 const url=`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/video/stream?call=${encodeURIComponent(callId)}`;
 const socket=new WebSocket(url);
 socket.binaryType='arraybuffer';let stopped=false,sending=false,lastRemote=0,nextAudio=0,remotePainting=false;
 const gain=audioContext.createGain();gain.connect(audioContext.destination);
 await audioContext.audioWorklet.addModule('/call-audio-worklet.js');
 const source=audioContext.createMediaStreamSource(stream);
 const processor=new AudioWorkletNode(audioContext,'helloagain-capture',{channelCount:1,channelCountMode:'explicit'});
 source.connect(processor);processor.connect(audioContext.destination);
 processor.port.onmessage=event=>{if(stopped||socket.readyState!==WebSocket.OPEN||socket.bufferedAmount>100000)return;const packet=new Uint8Array(4801);packet[0]=2;packet.set(new Uint8Array(event.data),1);socket.send(packet);};
 const clear=message=>{remoteCanvas.getContext('2d').clearRect(0,0,remoteCanvas.width,remoteCanvas.height);onRemote(false);if(message)onWarning(message);};
 const cleanup=()=>{if(stopped)return;stopped=true;clearInterval(frameTimer);clearInterval(staleTimer);processor.port.onmessage=null;source.disconnect();processor.disconnect();gain.disconnect();socket.close();clear();};
 socket.onmessage=async event=>{
  if(stopped)return;
  if(typeof event.data==='string'){const value=JSON.parse(event.data);if(value.type==='ended'){cleanup();onEnd(value.reason);}else if(value.type==='clear')clear(value.reason);else if(value.type==='camera_warning')onWarning(value.reason==='black_screen'?'Your camera is black. Uncover the lens and turn on a light.':value.reason==='not_visible'?'Keep your face clearly visible in the camera.':'Your camera picture could not be checked.');return;}
  const packet=new Uint8Array(event.data);
  if(packet[0]===1&&!remotePainting){remotePainting=true;try{const image=await createImageBitmap(new Blob([packet.subarray(1)],{type:'image/jpeg'}));if(!stopped){remoteCanvas.getContext('2d').drawImage(image,0,0,remoteCanvas.width,remoteCanvas.height);lastRemote=Date.now();onRemote(true);onWarning('');}image.close();}finally{remotePainting=false;}}
  else if(packet[0]===2&&packet.length===4801){const samples=new Int16Array(packet.slice(1).buffer);const buffer=audioContext.createBuffer(1,2400,24000);const output=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)output[i]=samples[i]/32768;if(nextAudio-audioContext.currentTime>.35)nextAudio=audioContext.currentTime;nextAudio=Math.max(audioContext.currentTime+.03,nextAudio);const sound=audioContext.createBufferSource();sound.buffer=buffer;sound.connect(gain);sound.start(nextAudio);nextAudio+=.1;}
 };
 socket.onerror=()=>{cleanup();onEnd('The call connection failed. Please try again.');};
 socket.onclose=()=>{if(!stopped){cleanup();onEnd('The call disconnected.');}};
 const sendFrame=async()=>{if(stopped||sending||socket.readyState!==WebSocket.OPEN||socket.bufferedAmount>120000)return;sending=true;try{const track=stream.getVideoTracks()[0];if(!track?.enabled||track.readyState!=='live')throw new Error('Keep your camera on throughout the call.');const blob=await captureCameraFrame(localVideo);if(stopped)return;const bytes=new Uint8Array(await blob.arrayBuffer()),packet=new Uint8Array(bytes.length+1);packet[0]=1;packet.set(bytes,1);socket.send(packet);}catch(e){cleanup();onEnd(e.message);}finally{sending=false;}};
 const frameTimer=setInterval(sendFrame,350);
 const staleTimer=setInterval(()=>{if(lastRemote&&Date.now()-lastRemote>2000)clear('Waiting for a clear camera picture.');},300);
 socket.onopen=sendFrame;
 return {close:cleanup,setMuted:muted=>{stream.getAudioTracks().forEach(t=>{t.enabled=!muted;});},setSpeaker:enabled=>{gain.gain.value=enabled?1:0;}};
}
