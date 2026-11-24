// Execute the real production entry point in native Node strip-only mode with no provider credentials.
// Vite/Vitest transpilation alone cannot catch unsupported TypeScript runtime syntax.
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
const dir=await mkdtemp(join(tmpdir(),'hafize-native-boot-'));
let child,closed;
try{
 const reservation=createServer();await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve)});
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const env={PATH:process.env.PATH||'',HOME:dir,USERPROFILE:dir, ...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{}),NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),HAFIZE_AUTH_REQUIRED:'false',HAFIZE_DATA_DIR:join(dir,'data'),HAFIZE_WORKSPACE_DIR:join(dir,'workspace'),HAFIZE_DAILY_IMPROVEMENT:'false'};
 let output='';let exited=false;
 child=spawn(process.execPath,['--import','./lib/production-guard.ts','server.ts'],{env,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>{output=(output+d).slice(-5000)});child.stderr.on('data',d=>{output=(output+d).slice(-5000)});
 closed=new Promise(resolve=>child.once('close',()=>{exited=true;resolve()}));
 child.once('error',e=>{output+=String(e);exited=true;});
 const deadline=Date.now()+30_000;let live=false;
 while(Date.now()<deadline&&!exited){
  try{const res=await fetch('http://127.0.0.1:'+port+'/api/health/live',{signal:AbortSignal.timeout(1000)});if(res.ok&&(await res.json()).status==='ok'){live=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!live)throw Error('Native backend startup failed:\n'+output);
 console.log('Native backend startup and public health endpoint: PASS');
}finally{
 if(child&&!child.killed){child.kill('SIGTERM');await Promise.race([closed,new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve()},3000);timer.unref?.();})]);}
 await rm(dir,{recursive:true,force:true});
}
