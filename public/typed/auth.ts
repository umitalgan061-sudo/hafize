interface AuthState { required:boolean; authenticated:boolean; csrf:string; loading:Promise<AuthState>|null; modal:AuthModal|null; }
interface AuthModal { backdrop:HTMLDivElement; form:HTMLFormElement; input:HTMLInputElement; error:HTMLElement; }
interface AuthPublicApi { readonly ready:Promise<AuthState>; readonly login:()=>void; readonly state:()=>{readonly required:boolean;readonly authenticated:boolean}; }
const rawFetch=globalThis.fetch.bind(globalThis);
const state:AuthState={required:false,authenticated:false,csrf:'',loading:null,modal:null};
const AUTH_PATHS=new Set(['/api/auth/session','/api/auth/login','/api/auth/logout']);

function apiPath(value:RequestInfo|URL):boolean{try{const u=new URL(typeof value==='string'?value:value instanceof URL?value.toString():value.url,location.href);return u.origin===location.origin&&u.pathname.startsWith('/api/');}catch{return false;}}
function authPath(value:RequestInfo|URL):boolean{try{const u=new URL(typeof value==='string'?value:value instanceof URL?value.toString():value.url,location.href);return AUTH_PATHS.has(u.pathname);}catch{return false;}}
function openModal():AuthModal{
 if(state.modal)return state.modal;
 const style=document.createElement('style');style.textContent='.hafize-auth-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(16,20,25,.46);backdrop-filter:blur(10px)}.hafize-auth-card{width:min(420px,100%);box-sizing:border-box;border:1px solid rgba(120,125,130,.24);border-radius:24px;padding:26px;background:var(--panel,#fff);box-shadow:0 24px 80px rgba(0,0,0,.22)}.hafize-auth-card h2{margin:0 0 8px}.hafize-auth-card p{margin:0 0 18px;opacity:.72;line-height:1.5}.hafize-auth-card label{display:block;font-size:13px;font-weight:700;margin-bottom:8px}.hafize-auth-card input{width:100%;box-sizing:border-box;border:1px solid rgba(120,125,130,.35);border-radius:14px;padding:12px 14px;background:transparent;color:inherit}.hafize-auth-card button{width:100%;margin-top:14px;border:0;border-radius:14px;padding:12px;font-weight:700;cursor:pointer}.hafize-auth-error{min-height:20px;margin-top:10px;font-size:13px;color:#a52323}';document.head.append(style);
 const backdrop=document.createElement('div');backdrop.className='hafize-auth-backdrop';
 const form=document.createElement('form');form.className='hafize-auth-card';form.setAttribute('aria-label','Hafize giriş');form.autocomplete='off';
 const heading=document.createElement('h2');heading.textContent="Hafize'ye giriş";
 const copy=document.createElement('p');copy.textContent='Bu Hafize sunucusu korunuyor. Erişim anahtarın kalıcı olarak tarayıcıya kaydedilmez.';
 const label=document.createElement('label');label.htmlFor='hafizeAuthToken';label.textContent='Erişim anahtarı';
 const input=document.createElement('input');input.id='hafizeAuthToken';input.type='password';input.minLength=32;input.autocomplete='current-password';input.required=true;
 const error=document.createElement('div');error.className='hafize-auth-error';error.setAttribute('role','alert');
 const submit=document.createElement('button');submit.type='submit';submit.textContent='Giriş yap';
 form.append(heading,copy,label,input,error,submit);backdrop.append(form);document.body.append(backdrop);
 const modal:AuthModal={backdrop,form,input,error};state.modal=modal;
 form.addEventListener('submit',async(event)=>{event.preventDefault();error.textContent='';form.setAttribute('aria-busy','true');try{
   const response=await rawFetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({token:input.value})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||payload.authenticated!==true)throw new Error(typeof payload.error==='string'?payload.error:'AUTH_REQUIRED');
   state.authenticated=true;state.csrf=typeof payload.csrf==='string'?payload.csrf:'';input.value='';backdrop.remove();state.modal=null;
 }catch(loginError){error.textContent=loginError instanceof Error&&loginError.message==='AUTH_REQUIRED'?'Erişim anahtarı geçersiz.':'Giriş yapılamadı. Sunucu bağlantısını kontrol et.';
 }finally{form.removeAttribute('aria-busy');if(state.modal)input.focus();}});
 return modal;
}
const openLogin=()=>{const value=openModal();if(!document.body.contains(value.backdrop))document.body.append(value.backdrop);value.input.focus();};
async function refresh():Promise<AuthState>{
 if(state.loading)return state.loading;
 state.loading=(async()=>{const response=await rawFetch('/api/auth/session',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});if(!response.ok)throw new Error('AUTH_SESSION_FAILED');const payload=await response.json();state.required=Boolean(payload?.required);state.authenticated=Boolean(payload?.authenticated);state.csrf=typeof payload?.csrf==='string'?payload.csrf:'';return state;})();
 try{return await state.loading;}finally{state.loading=null;}
}
async function ensureAuth():Promise<void>{await refresh();if(!state.required||state.authenticated)return;openLogin();while(!state.authenticated){await new Promise<void>(resolve=>globalThis.setTimeout(resolve,200));await refresh();}}
async function hafizeFetch(input:RequestInfo|URL,init:RequestInit={}){if(!apiPath(input)||authPath(input))return rawFetch(input,init);await ensureAuth();const next:RequestInit={...init,credentials:'same-origin'};const method=String(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();if(!['GET','HEAD'].includes(method)){const headers=new Headers(next.headers||{});if(state.csrf)headers.set('X-Hafize-CSRF',state.csrf);next.headers=headers;}let response=await rawFetch(input,next);if(response.status!==401)return response;state.authenticated=false;state.csrf='';await ensureAuth();if(!['GET','HEAD'].includes(method)){const headers=new Headers(next.headers||{});if(state.csrf)headers.set('X-Hafize-CSRF',state.csrf);next.headers=headers;}return rawFetch(input,next);}
globalThis.fetch=hafizeFetch;
const api:AuthPublicApi=Object.freeze({ready:refresh().catch(()=>state),login:openLogin,state:()=>Object.freeze({required:state.required,authenticated:state.authenticated})});
(globalThis as typeof globalThis & {HafizeAuth?:AuthPublicApi}).HafizeAuth=api;
export { api as HafizeAuth };
