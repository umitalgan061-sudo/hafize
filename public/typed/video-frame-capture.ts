export function videoSampleTimes(duration:number):number[]{
 if(!Number.isFinite(duration)||duration<0.25||duration>300)throw Error('0,25–300 saniyelik desteklenen bir video seç.');
 return [0.1,0.35,0.65,0.9].map(fraction=>duration*fraction);
}
export async function captureVideoFrames(selected:File,signal:AbortSignal,documentRef:Document=document,root:typeof globalThis=globalThis){
 if(selected.size>100*1024*1024||selected.size===0)throw Error('En fazla 100 MB video seç.');
 signal.throwIfAborted();
 const video=documentRef.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
 const url=root.URL.createObjectURL(selected);
 const wait=(event:string,start:()=>void)=>new Promise<void>((resolve,reject)=>{
  const done=(error?:Error)=>{root.clearTimeout(timer);video.removeEventListener(event,success);video.removeEventListener('error',failure);signal.removeEventListener('abort',cancelled);error?reject(error):resolve();};
  const success=()=>done();const failure=()=>done(Error('Video okunamadı.'));const cancelled=()=>done(Error('İşlem iptal edildi.'));
  const timer=root.setTimeout(()=>done(Error('Video okuma zaman aşımı.')),15000);
  video.addEventListener(event,success,{once:true});video.addEventListener('error',failure,{once:true});signal.addEventListener('abort',cancelled,{once:true});
  if(signal.aborted)cancelled();else try{start();}catch{failure();}
 });
 try{
  await wait('loadeddata',()=>{video.src=url;video.load();});
  const duration=video.duration;const times=videoSampleTimes(duration);
  if(!video.videoWidth||!video.videoHeight)throw Error('Video boyutları okunamadı.');
  const canvas=documentRef.createElement('canvas');const scale=Math.min(1,768/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kare çıkarma desteklenmiyor.');
  const frames:{time:number;data:string}[]=[];
  for(const time of times){
   signal.throwIfAborted();
   if(Math.abs(video.currentTime-time)>0.001)await wait('seeked',()=>{video.currentTime=time;});
   ctx.drawImage(video,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL('image/jpeg',0.72).split(',')[1];
   if(!data||data.length>Math.ceil(512*1024/3)*4)throw Error('Video karesi çok büyük.');
   frames.push({time,data});
  }
  return {duration,frames};
 }finally{try{video.pause();video.removeAttribute('src');video.load();}finally{root.URL.revokeObjectURL(url);}}
}
