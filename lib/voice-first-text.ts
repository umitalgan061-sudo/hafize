// Require actual visible assistant content before committing to a voice response.
// Do not speak reasoning deltas or switch models after the first answer is visible.
export async function waitForFirstVoiceText(response:Response,signal:AbortSignal):Promise<Response>{
  if(!response.ok)return response;
  if(!response.body)throw Error('VOICE_EMPTY_STREAM');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  const buffered:Uint8Array<ArrayBuffer>[]=[];let size=0,lineBuffer='',visible=false;
  const onAbort=()=>{void reader.cancel(signal.reason).catch(()=>undefined);};
  signal.addEventListener('abort',onAbort,{once:true});
  const inspect=(line:string)=>{
    if(!line.startsWith('data:'))return;
    const raw=line.slice(5).trim();if(!raw)return;
    if(raw==='[DONE]'){if(!visible)throw Error('VOICE_EMPTY_STREAM');return;}
    let parsed:any;try{parsed=JSON.parse(raw);}catch{return;}
    if(parsed?.error)throw Error('VOICE_UPSTREAM_ERROR');
    const content=parsed?.choices?.[0]?.delta?.content;
    if(typeof content==='string'&&content.trim())visible=true;
  };
  try{
    signal.throwIfAborted();
    while(!visible){
      const next=await reader.read();signal.throwIfAborted();
      if(next.done){lineBuffer+=decoder.decode();if(lineBuffer)inspect(lineBuffer);if(!visible)throw Error('VOICE_EMPTY_STREAM');break;}
      size+=next.value.byteLength;
      if(size>256*1024)throw Error('VOICE_FIRST_TEXT_BUFFER_LIMIT');
      buffered.push(new Uint8Array(next.value));lineBuffer+=decoder.decode(next.value,{stream:true});
      let at=lineBuffer.indexOf('\n');
      while(at!==-1&&!visible){inspect(lineBuffer.slice(0,at).replace(/\r$/,''));lineBuffer=lineBuffer.slice(at+1);at=lineBuffer.indexOf('\n');}
    }
    signal.removeEventListener('abort',onAbort);
    // Preserve every original SSE byte and keep the underlying stream cancellable.
    const stream=new ReadableStream<Uint8Array>({
      start(controller){for(const chunk of buffered)controller.enqueue(chunk);},
      async pull(controller){
        try{const n=await reader.read();if(n.done){reader.releaseLock();controller.close();}else controller.enqueue(n.value);}
        catch(e){try{reader.releaseLock();}catch{}controller.error(e);}
      },
      async cancel(reason){try{await reader.cancel(reason);}finally{try{reader.releaseLock();}catch{}}}
    });
    return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(e){
    signal.removeEventListener('abort',onAbort);
    void reader.cancel().catch(()=>undefined);
    try{reader.releaseLock();}catch{}
    throw e;
  }
}
