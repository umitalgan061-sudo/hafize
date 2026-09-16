import { Disposer, dispatch, boundedText, safeJsonParse, sameOriginPath, text } from './browser-platform.ts';

type AuthSessionPayload = { required?: unknown; authenticated?: unknown; csrf?: unknown };
type LoginPayload = { authenticated?: unknown; csrf?: unknown; error?: unknown };
type AuthState = { required: boolean; authenticated: boolean; csrf: string };
type LoginModal = { backdrop: HTMLDivElement; form: HTMLFormElement; input: HTMLInputElement; error: HTMLDivElement };

declare global {
  interface Window { HafizeAuth?: Readonly<{ ready: Promise<AuthState>; login: () => void; readonly state: { required: boolean; authenticated: boolean } }> }
}

const AUTH_PATHS = new Set(['/api/auth/session', '/api/auth/login', '/api/auth/logout']);
const state: AuthState & { loading: Promise<AuthState> | null; modal: LoginModal | null } = { required: false, authenticated: false, csrf: '', loading: null, modal: null };
const rawFetch = window.fetch.bind(window);
const disposers = new Disposer();

const apiPath = (value: RequestInfo | URL): boolean => {
  const path = sameOriginPath(typeof value === 'string' ? value : value instanceof URL ? value.href : value.url);
  return Boolean(path?.startsWith('/api/'));
};
const authPath = (value: RequestInfo | URL): boolean => {
  const path = sameOriginPath(typeof value === 'string' ? value : value instanceof URL ? value.href : value.url);
  return Boolean(path && AUTH_PATHS.has(path));
};

function setState(payload: AuthSessionPayload): AuthState {
  state.required = Boolean(payload.required);
  state.authenticated = Boolean(payload.authenticated);
  state.csrf = typeof payload.csrf === 'string' ? boundedText(payload.csrf, 512) : '';
  return state;
}

function getStyle(documentRef: Document): void {
  if (documentRef.getElementById('hafizeAuthStyle')) return;
  const style = documentRef.createElement('style');
  style.id = 'hafizeAuthStyle';
  style.textContent = '.hafize-auth-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(16,20,25,.46);backdrop-filter:blur(10px)}.hafize-auth-card{width:min(420px,100%);box-sizing:border-box;border:1px solid rgba(120,125,130,.24);border-radius:24px;padding:26px;background:var(--panel,#fff);box-shadow:0 24px 80px rgba(0,0,0,.22)}.hafize-auth-card h2{margin:0 0 8px}.hafize-auth-card p{margin:0 0 18px;opacity:.72;line-height:1.5}.hafize-auth-card label{display:block;font-size:13px;font-weight:700;margin-bottom:8px}.hafize-auth-card input{width:100%;box-sizing:border-box;border:1px solid rgba(120,125,130,.35);border-radius:14px;padding:12px 14px;background:transparent;color:inherit}.hafize-auth-card button{width:100%;margin-top:14px;border:0;border-radius:14px;padding:12px;font-weight:700;cursor:pointer}.hafize-auth-error{min-height:20px;margin-top:10px;font-size:13px;color:#a52323}';
  documentRef.head.append(style);
}

function openLogin(): void {
  if (state.modal) { state.modal.input.focus(); return; }
  const documentRef = document;
  getStyle(documentRef);
  const backdrop = documentRef.createElement('div');
  backdrop.className = 'hafize-auth-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'hafizeAuthTitle');
  const form = documentRef.createElement('form'); form.className = 'hafize-auth-card'; form.autocomplete = 'off';
  const title = text<HTMLHeadingElement>(documentRef, 'h2', 'Hafize’ye giriş'); title.id = 'hafizeAuthTitle';
  const desc = text<HTMLParagraphElement>(documentRef, 'p', 'Bu Hafize sunucusu korunuyor. Erişim anahtarın kalıcı olarak tarayıcıya kaydedilmez.');
  const label = text<HTMLLabelElement>(documentRef, 'label', 'Erişim anahtarı'); label.htmlFor = 'hafizeAuthToken';
  const input = documentRef.createElement('input'); input.id = 'hafizeAuthToken'; input.type = 'password'; input.minLength = 32; input.autocomplete = 'current-password'; input.required = true; input.maxLength = 4096;
  const error = text<HTMLDivElement>(documentRef, 'div', '', 'hafize-auth-error'); error.setAttribute('role', 'alert');
  const submit = text<HTMLButtonElement>(documentRef, 'button', 'Giriş yap'); submit.type = 'submit';
  form.append(title, desc, label, input, error, submit); backdrop.append(form); documentRef.body.append(backdrop);
  const modal: LoginModal = { backdrop, form, input, error }; state.modal = modal;
  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault(); error.textContent = ''; form.setAttribute('aria-busy', 'true');
    try {
      const response = await rawFetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ token: input.value }) });
      const payload = await response.json().catch(() => ({} as LoginPayload)) as LoginPayload;
      if (!response.ok || payload.authenticated !== true) throw new Error(typeof payload.error === 'string' ? payload.error : 'AUTH_REQUIRED');
      state.authenticated = true; state.csrf = typeof payload.csrf === 'string' ? boundedText(payload.csrf, 512) : '';
      input.value = ''; backdrop.remove(); state.modal = null; dispatch(window, 'hafize:auth-changed', { authenticated: true });
    } catch (errorValue) {
      const code = errorValue instanceof Error ? errorValue.message : '';
      error.textContent = code === 'AUTH_REQUIRED' ? 'Erişim anahtarı geçersiz.' : 'Giriş yapılamadı. Sunucu bağlantısını kontrol et.';
    } finally { form.removeAttribute('aria-busy'); if (state.modal) input.focus(); }
  };
  form.addEventListener('submit', onSubmit);
  disposers.add(() => form.removeEventListener('submit', onSubmit));
  input.focus();
}

async function refresh(): Promise<AuthState> {
  if (state.loading) return state.loading;
  state.loading = (async () => {
    const response = await rawFetch('/api/auth/session', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('AUTH_SESSION_FAILED');
    return setState(await response.json() as AuthSessionPayload);
  })();
  try { return await state.loading; } finally { state.loading = null; }
}

async function ensure(): Promise<void> {
  await refresh();
  if (!state.required || state.authenticated) return;
  openLogin();
  while (!state.authenticated) { await new Promise<void>((resolve) => window.setTimeout(resolve, 200)); await refresh(); }
}

window.fetch = async function hafizeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (!apiPath(input) || authPath(input)) return rawFetch(input, init);
  await ensure();
  const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const next: RequestInit = { ...init, credentials: 'same-origin' };
  if (!['GET', 'HEAD'].includes(method)) { const headers = new Headers(next.headers || {}); if (state.csrf) headers.set('X-Hafize-CSRF', state.csrf); next.headers = headers; }
  let response = await rawFetch(input, next);
  if (response.status !== 401) return response;
  state.authenticated = false; state.csrf = ''; dispatch(window, 'hafize:auth-changed', { authenticated: false }); await ensure();
  if (!['GET', 'HEAD'].includes(method)) { const headers = new Headers(next.headers || {}); headers.delete('X-Hafize-CSRF'); if (state.csrf) headers.set('X-Hafize-CSRF', state.csrf); next.headers = headers; }
  response = await rawFetch(input, next); return response;
};

window.HafizeAuth = Object.freeze({ ready: refresh().catch(() => state), login: openLogin, get state() { return { required: state.required, authenticated: state.authenticated }; } });

export const HafizeAuthRuntime = Object.freeze({ refresh, ensure, state, destroy: () => { if (state.modal) { state.modal.backdrop.remove(); state.modal = null; } disposers.flush(); } });
