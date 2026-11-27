/**
 * Track admitted HTTP agent handlers through their asynchronous terminal
 * journal save, not just until their local active-turn marker is removed.
 * No new work is admitted after shutdown starts.
 */
export function createAgentRequestDrain(){
 let closing=false;
 const active=new Set<Promise<unknown>>();
 function start<T>(work:()=>Promise<T>):Promise<T>|null{
  if(closing)return null;
  const task=Promise.resolve().then(work);
  active.add(task);
  const remove=()=>{active.delete(task);};
  void task.then(remove,remove);
  return task;
 }
 function stop(){closing=true;}
 async function drain(timeoutMs=12_000):Promise<boolean>{
  stop();
  if(!active.size)return true;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   return await Promise.race([
    Promise.allSettled([...active]).then(()=>true),
    new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),Math.max(0,timeoutMs));})
   ]);
  }finally{if(timer!==undefined)clearTimeout(timer);}
 }
 return Object.freeze({start,stop,drain,closing:()=>closing,activeCount:()=>active.size});
}
