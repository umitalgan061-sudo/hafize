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
 // A release from an agent handler may count only that handler; an
 // external publisher must see zero. Include requests still awaiting
 // authentication/Redis and terminal saves, not just local turn markers.
 function canReserveDeployment(expectedActive:0|1=0):boolean{
  return !closing&&active.size===expectedActive;
 }
 return Object.freeze({start,stop,drain,closing:()=>closing,activeCount:()=>active.size,canReserveDeployment});
}
