// Hafize's own look for the pieces the browser draws by itself: the question windows that alert(), confirm() and
// prompt() used to open (white, plain, the same in every theme), the scrollbars, and an orange light that runs around
// the edge of the screen while Hafize is working.
//
// The browser's windows stop the page until answered; these cannot, so each one is a promise the caller awaits.

const STYLE_ID = 'hafizeThemePolish';
const CSS = `
:root{--hz-orange:var(--premium-orange,#dd7a52)}
/* Scrollbars in the theme: thin, rounded, orange-tinted; the track stays out of sight. */
*{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--hz-orange) 42%,transparent) transparent}
*:hover{scrollbar-color:color-mix(in srgb,var(--hz-orange) 68%,transparent) transparent}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{border:3px solid transparent;border-radius:999px;background:color-mix(in srgb,var(--hz-orange) 42%,transparent);background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb,var(--hz-orange) 70%,transparent)}
::-webkit-scrollbar-corner{background:transparent}
/* One scrollbar in the chat, on the screen's right edge. On a phone the list reaches both edges of the screen while
   its words stay where they were; the chat's scroll no longer runs on into the page, whose own bar (the page is a
   little taller than the screen in the installed app, see polish.css) stays out of sight. */
#messages{overscroll-behavior-y:contain}
@media (max-width:700px){
  #messages.hz-edge{width:auto!important;max-width:none!important;margin-left:calc(-1 * var(--hz-edge-l,0px))!important;margin-right:calc(-1 * var(--hz-edge-r,0px))!important;padding-left:var(--hz-edge-l,0px)!important;padding-right:var(--hz-edge-r,0px)!important;box-sizing:border-box!important}
}
@media (display-mode:standalone){html,body{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;width:0;height:0}}
::selection{background:color-mix(in srgb,var(--hz-orange) 32%,transparent)}

/* "12 sn düşündü", "Bulutta 2 dk çalıştı" beside the name above a message. */
.message-took{display:inline-flex;align-items:center;gap:5px;margin-left:9px;padding:1px 9px;border:1px solid color-mix(in srgb,var(--hz-orange) 22%,transparent);border-radius:999px;background:color-mix(in srgb,var(--hz-orange) 8%,transparent);color:var(--muted,inherit);font-size:11.5px;font-weight:500;letter-spacing:0;text-transform:none;vertical-align:1px}
.message-took::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--hz-orange);opacity:.75}
/* The strip just above the message box, on the left: "Düşünüyor · 3 sn" nearest the box, a background task above it. */
/* The strip just above the message box, on the left, in one line: "Düşünüyor · 3 sn" and "1 görev çalışıyor" side by
   side; with both there, they read as a single pill, the way a terminal assistant shows its status. */
.hz-dock{position:absolute;left:12px;right:12px;bottom:calc(100% + 10px);z-index:6;display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:8px;pointer-events:none}
.hz-dock>*{pointer-events:auto}
.hz-dock>.chat-thinking{order:0}.hz-dock>.hz-bg-line{order:1}
.hz-dock:empty{display:none}
.hz-dock:has(>.chat-thinking:not([hidden])):has(>.hz-bg-line:not([hidden])){right:auto;max-width:calc(100% - 24px);gap:0;padding:0 4px 0 0;border:1px solid color-mix(in srgb,var(--hz-orange) 32%,transparent);border-radius:999px;background:color-mix(in srgb,var(--bg,#fff) 82%,var(--hz-orange) 8%);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);box-shadow:0 6px 20px rgb(0 0 0/.16);flex-wrap:nowrap}
.hz-dock:has(>.chat-thinking:not([hidden])):has(>.hz-bg-line:not([hidden]))>*{border:0!important;background:none!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;animation:none}
.hz-dock:has(>.chat-thinking:not([hidden])):has(>.hz-bg-line:not([hidden]))>.chat-thinking{padding-right:6px}
.hz-dock:has(>.chat-thinking:not([hidden])):has(>.hz-bg-line:not([hidden]))>.hz-bg-line{padding-left:0;min-width:0}
.hz-dock:has(>.chat-thinking:not([hidden])):has(>.hz-bg-line:not([hidden]))>.hz-bg-line .hz-bg-glyph{display:none}
.hz-dock:has(>.chat-thinking:not([hidden])):has(>.hz-bg-line:not([hidden]))>.hz-bg-line .hz-bg-name::before{content:"· ";color:var(--muted,inherit);-webkit-text-fill-color:var(--muted,currentColor)}
/* Room at the end of the chat, so its last lines are never under the strip. */
html.hafize-working #messages::after,body.hz-bg-on #messages::after{content:"";display:block;height:58px}
/* Only as wide as its words, on every browser, with the words lit like the task line. */
.chat-thinking,#messages .chat-thinking{display:inline-flex;box-sizing:border-box;width:max-content;max-width:100%;justify-self:start;align-self:flex-start;margin:0;padding:7px 14px 7px 12px;gap:9px;border:1px solid color-mix(in srgb,var(--hz-orange) 32%,transparent);border-radius:999px;background:color-mix(in srgb,var(--bg,#fff) 82%,var(--hz-orange) 8%);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);box-shadow:0 6px 20px rgb(0 0 0/.16);font-size:13px;white-space:nowrap;animation:hz-think-in .28s cubic-bezier(.2,.9,.3,1.2)}
.chat-thinking[hidden]{display:none}
@keyframes hz-think-in{from{opacity:0;transform:translateY(6px) scale(.97)}}
html .chat-thinking .chat-thinking-label{font-weight:600;background:linear-gradient(100deg,var(--hz-orange) 0%,var(--hz-orange) 38%,#ffd9c4 50%,var(--hz-orange) 62%,var(--hz-orange) 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:hz-think-shimmer 2.2s linear infinite}
/* On a light page a pale highlight washes the words out; there the light runs darker. */
html[data-theme="light"] .chat-thinking .chat-thinking-label,html[data-theme="light"] .hz-bg-name{background-image:linear-gradient(100deg,var(--hz-orange) 0%,var(--hz-orange) 38%,#9c3d17 50%,var(--hz-orange) 62%,var(--hz-orange) 100%)}
@keyframes hz-think-shimmer{from{background-position:125% 0}to{background-position:-125% 0}}
@media (prefers-reduced-motion:reduce){html .chat-thinking .chat-thinking-label{animation:none;background:none;color:var(--hz-orange)}}
.chat-thinking-time{margin-left:2px;color:var(--muted,inherit);font-size:.92em;font-variant-numeric:tabular-nums}
.chat-thinking-time:not(:empty)::before{content:"· "}

/* The short notices: in the theme's own colours with an orange edge, instead of a negative of the page. */
html[data-theme] .toast:not(.hidden),html .toast:not(.hidden){background:color-mix(in srgb,var(--panel,var(--card,#fff)) 90%,transparent);color:var(--text,inherit);border:1px solid color-mix(in srgb,var(--hz-orange) 45%,transparent);border-left:4px solid var(--hz-orange);box-shadow:0 12px 34px rgb(0 0 0/.26);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3)}

/* A background job's raw output: a quiet line, folded, under which Hafize writes the answer. Not the owner's message,
   so it has none of a message's buttons. */
.message.is-background-output,.message.user.is-background-output{justify-self:start;align-self:flex-start;width:auto;max-width:100%;margin-block:2px;padding:0;border:0;border-radius:0;background:none;box-shadow:none;opacity:.9}
.message.is-background-output>:not(.meta):not(.content){display:none!important}
.message.is-background-output .meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.message.is-background-output .content{font-size:.9em;white-space:normal}
.message.is-background-output .background-output[open]{padding:10px 12px;border:1px solid var(--line,#ccc);border-radius:14px;background:var(--card,transparent)}
.background-output>summary{display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--muted,inherit);font-size:13px;list-style:none;padding:4px 11px;border:1px solid var(--line,#ccc);border-radius:999px}
.background-output>summary::-webkit-details-marker{display:none}
.background-output>summary::before{content:"▸";transition:transform .15s ease}
.background-output[open]>summary::before{transform:rotate(90deg)}
.background-output[open]>summary{margin-bottom:8px}

/* A new message comes in softly. */
.message.is-new{animation:hz-msg-in .32s cubic-bezier(.2,.8,.3,1) both}
.message.user.is-new{animation-name:hz-msg-in-user}
@keyframes hz-msg-in{from{opacity:0;transform:translateY(8px)}}
@keyframes hz-msg-in-user{from{opacity:0;transform:translateY(8px) scale(.98)}}
/* Before the first words: three soft lines that shimmer, instead of a bare "…". */
.message.assistant.is-waiting .content{position:relative;min-height:50px;color:transparent}
.message.assistant.is-waiting .content>*{visibility:hidden}
.message.assistant.is-waiting .content::before{content:"";position:absolute;inset:6px 0 auto 0;height:44px;max-width:min(380px,100%);background:linear-gradient(90deg,color-mix(in srgb,var(--hz-orange) 7%,transparent) 0%,color-mix(in srgb,var(--hz-orange) 18%,transparent) 50%,color-mix(in srgb,var(--hz-orange) 7%,transparent) 100%) 0 0/200% 100%;-webkit-mask:linear-gradient(#000 0 0) 0 0/94% 9px no-repeat,linear-gradient(#000 0 0) 0 17px/76% 9px no-repeat,linear-gradient(#000 0 0) 0 34px/48% 9px no-repeat;mask:linear-gradient(#000 0 0) 0 0/94% 9px no-repeat,linear-gradient(#000 0 0) 0 17px/76% 9px no-repeat,linear-gradient(#000 0 0) 0 34px/48% 9px no-repeat;animation:hz-skeleton 1.4s ease-in-out infinite}
@keyframes hz-skeleton{from{background-position:100% 0}to{background-position:-100% 0}}
/* While the answer is being written, a caret after its last word. */
.message.assistant.is-streaming:not(.is-waiting) .content>:is(p,h1,h2,h3,h4,blockquote):last-child::after,.message.assistant.is-streaming:not(.is-waiting) .content>:is(ul,ol):last-child>li:last-child::after{content:"";display:inline-block;width:.48em;height:1.05em;margin-left:3px;vertical-align:-.16em;border-radius:2px;background:var(--hz-orange);animation:hz-caret 1s steps(2,jump-none) infinite}
@keyframes hz-caret{50%{opacity:0}}
/* The steps Hafize took are a quiet line above the answer, not loud buttons. */
.tool-activities{gap:5px!important;margin:0 0 9px!important}
.tool-activity{display:inline-flex;align-items:center;gap:5px;padding:2px 9px!important;border:1px solid color-mix(in srgb,var(--hz-orange) 18%,transparent)!important;border-radius:999px!important;background:transparent!important;color:var(--muted,inherit)!important;font-size:11.5px!important;font-weight:500;line-height:1.6}
.tool-activity::before{content:"✓";color:var(--hz-orange);font-size:10px;font-weight:700}
.tool-activity.failed::before{content:"!";color:#e5484d}
/* The message box lights up a little when it is being written in. */
#composer{transition:box-shadow .2s ease,border-color .2s ease}
#composer:focus-within{border-color:color-mix(in srgb,var(--hz-orange) 55%,var(--line,#ccc))!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--hz-orange) 14%,transparent),0 14px 40px rgb(0 0 0/.18)!important}
.send-btn{transition:transform .12s ease,filter .15s ease,box-shadow .2s ease}
.send-btn:not(:disabled):hover{filter:brightness(1.06);box-shadow:0 6px 18px color-mix(in srgb,var(--hz-orange) 35%,transparent)}
.send-btn:not(:disabled):active{transform:scale(.94)}
/* A question left without an answer. */
.unanswered-row{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:-10px;color:var(--muted,inherit);font-size:13px}
.unanswered-btn{min-height:34px;padding:0 14px;border:1px solid color-mix(in srgb,var(--hz-orange) 45%,transparent);border-radius:999px;background:color-mix(in srgb,var(--hz-orange) 12%,transparent);color:var(--hz-orange);font:inherit;font-weight:650;cursor:pointer}
.unanswered-btn:hover{background:color-mix(in srgb,var(--hz-orange) 20%,transparent)}
@media (prefers-reduced-motion:reduce){.message.is-new,.message.assistant.is-waiting .content::before{animation:none}.message.assistant.is-streaming .content :is(p,h1,h2,h3,h4,blockquote,li)::after{animation:none}}

/* The light around the screen. */
@property --hz-frame-angle{syntax:'<angle>';initial-value:0deg;inherits:false}
.hz-frame{position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:0;transition:opacity .6s ease}
.hz-frame>i{position:absolute;inset:0;padding:3px;border-radius:inherit;background:conic-gradient(from var(--hz-frame-angle),transparent 0deg,transparent 200deg,color-mix(in srgb,var(--hz-orange) 40%,transparent) 250deg,var(--hz-orange) 300deg,#ffd2b8 325deg,var(--hz-orange) 340deg,transparent 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:hz-frame-run 3.4s linear infinite}
.hz-frame>i+i{padding:6px;filter:blur(9px);opacity:.55}
html.hafize-working .hz-frame,html.hafize-flash .hz-frame{opacity:1}
html.hafize-flash .hz-frame>i{animation-duration:1.6s}
@keyframes hz-frame-run{to{--hz-frame-angle:360deg}}
@media (display-mode:standalone) and (pointer:coarse){.hz-frame{border-radius:46px}}
@media (prefers-reduced-motion:reduce){.hz-frame>i{animation:none;background:color-mix(in srgb,var(--hz-orange) 55%,transparent)}.hz-frame>i+i{display:none}}

/* The question window. */
.hz-ask{width:min(440px,calc(100vw - 28px));max-height:calc(100dvh - 40px);margin:auto;padding:0;border:1px solid color-mix(in srgb,var(--hz-orange) 30%,var(--line,#ddd));border-radius:20px;background:var(--panel,var(--card,#fff));color:var(--text,inherit);box-shadow:0 24px 70px rgb(0 0 0/.32),inset 0 1px 0 rgb(255 255 255/.05);font:15px/1.5 "Segoe UI",system-ui,sans-serif;overflow:auto}
.hz-ask[open]{animation:hz-ask-in .22s cubic-bezier(.2,.9,.3,1.15)}
.hz-ask::backdrop{background:rgb(10 8 6/.48);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:hz-ask-fade .2s ease}
.hz-ask form{display:flex;flex-direction:column;gap:14px;padding:20px 20px 18px}
.hz-ask-head{display:flex;align-items:center;gap:11px}
.hz-ask-icon{flex:0 0 auto;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:color-mix(in srgb,var(--hz-orange) 16%,transparent);color:var(--hz-orange);font-size:17px;font-weight:700}
.hz-ask.is-danger .hz-ask-icon{background:color-mix(in srgb,#e5484d 16%,transparent);color:#e5484d}
.hz-ask-title{margin:0;font-size:16.5px;font-weight:650;line-height:1.35}
.hz-ask-text{margin:0;color:var(--muted,inherit);white-space:pre-wrap;overflow-wrap:anywhere;max-height:44dvh;overflow:auto}
.hz-ask-input{width:100%;box-sizing:border-box;min-height:44px;padding:10px 12px;border:1px solid var(--line,#ccc);border-radius:12px;background:var(--card,transparent);color:var(--text,inherit);font:inherit;outline:none;transition:border-color .15s ease,box-shadow .15s ease}
.hz-ask-input:focus{border-color:var(--hz-orange);box-shadow:0 0 0 3px color-mix(in srgb,var(--hz-orange) 22%,transparent)}
.hz-ask-choices{display:flex;flex-direction:column;gap:8px}
.hz-ask-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap}
.hz-ask-btn{min-height:42px;padding:0 17px;border:1px solid var(--line,#ccc);border-radius:12px;background:transparent;color:var(--text,inherit);font:inherit;font-weight:550;cursor:pointer;transition:background .15s ease,transform .1s ease,border-color .15s ease}
.hz-ask-btn:hover{background:color-mix(in srgb,var(--hz-orange) 10%,transparent);border-color:color-mix(in srgb,var(--hz-orange) 40%,var(--line,#ccc))}
.hz-ask-btn:active{transform:scale(.97)}
.hz-ask-btn:focus-visible{outline:2px solid var(--hz-orange);outline-offset:2px}
.hz-ask-btn.is-main{border-color:transparent;background:var(--hz-orange);color:#1f1408;font-weight:650}
.hz-ask-btn.is-main:hover{background:color-mix(in srgb,var(--hz-orange) 86%,#fff)}
.hz-ask.is-danger .hz-ask-btn.is-main{background:#e5484d;color:#fff}
.hz-ask-choices .hz-ask-btn{justify-content:flex-start;text-align:left;width:100%}
@keyframes hz-ask-in{from{opacity:0;transform:translateY(10px) scale(.96)}}
@keyframes hz-ask-fade{from{opacity:0}}
@media (max-width:520px){.hz-ask{margin:auto auto 12px;border-radius:22px}.hz-ask-actions{display:grid;grid-template-columns:1fr 1fr}.hz-ask-actions .hz-ask-btn:only-child{grid-column:1/-1}}
@media (prefers-reduced-motion:reduce){.hz-ask[open],.hz-ask::backdrop{animation:none}}
`;

function install(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
  const frame = document.createElement('div');
  frame.className = 'hz-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.append(document.createElement('i'), document.createElement('i'));
  (document.body ?? document.documentElement).append(frame);
}

/** How far the chat list stands from the screen's edges, measured, so on a phone it can reach them (see the CSS). */
function fitChatToEdges(): void {
  const messages = document.getElementById('messages');
  const host = messages?.parentElement;
  if (!messages || !host) return;
  const measure = () => {
    if (!matchMedia('(max-width: 700px)').matches) { messages.classList.remove('hz-edge'); return; }
    const box = host.getBoundingClientRect();
    const left = Math.max(0, Math.round(box.left + (parseFloat(getComputedStyle(host).paddingLeft) || 0)));
    const right = Math.max(0, Math.round(document.documentElement.clientWidth - box.right + (parseFloat(getComputedStyle(host).paddingRight) || 0)));
    messages.style.setProperty('--hz-edge-l', `${left}px`);
    messages.style.setProperty('--hz-edge-r', `${right}px`);
    messages.classList.add('hz-edge');
  };
  measure();
  new ResizeObserver(measure).observe(document.documentElement);
  addEventListener('resize', measure);
}

/** A short run of the light, for a moment worth noticing, such as background work finishing. */
export function flashFrame(ms = 2400): void {
  const root = document.documentElement;
  root.classList.add('hafize-flash');
  setTimeout(() => root.classList.remove('hafize-flash'), ms);
}

interface AskOptions {
  readonly title?: string;
  readonly ok?: string;
  readonly cancel?: string;
  readonly danger?: boolean;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** One window; resolves with what was chosen, or null when it was closed. */
function open<T>(build: (form: HTMLFormElement, finish: (value: T | null) => void) => HTMLElement | null, message: string, options: AskOptions, icon: string): Promise<T | null> {
  install();
  return new Promise((resolve) => {
    const dialog = make('dialog', `hz-ask${options.danger ? ' is-danger' : ''}`);
    const form = make('form', '');
    form.method = 'dialog';
    const head = make('div', 'hz-ask-head');
    const mark = make('span', 'hz-ask-icon', icon);
    mark.setAttribute('aria-hidden', 'true');
    const title = make('h2', 'hz-ask-title', options.title ?? (options.danger ? 'Emin misin?' : 'Hafize'));
    head.append(mark, title);
    form.append(head);
    if (message) form.append(make('p', 'hz-ask-text', message));
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const focus = build(form, finish);
    dialog.append(form);
    dialog.setAttribute('aria-labelledby', (title.id = `hzAsk${Date.now().toString(36)}`));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) finish(null); });
    document.body.append(dialog);
    dialog.showModal();
    (focus ?? form.querySelector<HTMLElement>('.is-main'))?.focus();
  });
}

function actions(form: HTMLFormElement, options: AskOptions, onOk: () => void, onCancel: () => void, withCancel = true): void {
  const row = make('div', 'hz-ask-actions');
  if (withCancel) {
    const cancel = make('button', 'hz-ask-btn', options.cancel ?? 'Vazgeç');
    cancel.type = 'button';
    cancel.addEventListener('click', onCancel);
    row.append(cancel);
  }
  const ok = make('button', 'hz-ask-btn is-main', options.ok ?? (options.danger ? 'Sil' : 'Tamam'));
  ok.type = 'submit';
  row.append(ok);
  form.addEventListener('submit', (event) => { event.preventDefault(); onOk(); });
  form.append(row);
}

/** confirm(), in the theme: true for yes. */
export async function askConfirm(message: string, options: AskOptions = {}): Promise<boolean> {
  const answer = await open<boolean>((form, finish) => { actions(form, options, () => finish(true), () => finish(null)); return null; }, message, options, options.danger ? '!' : '?');
  return answer === true;
}

/** prompt(), in the theme: the text, or null when it was cancelled. */
export function askText(message: string, value = '', options: AskOptions & { readonly placeholder?: string; readonly maxLength?: number } = {}): Promise<string | null> {
  return open<string>((form, finish) => {
    const input = make('input', 'hz-ask-input');
    input.type = 'text';
    input.value = value;
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.maxLength) input.maxLength = options.maxLength;
    input.setAttribute('aria-label', message || options.title || 'Metin');
    form.append(input);
    actions(form, options, () => finish(input.value), () => finish(null));
    queueMicrotask(() => input.select());
    return input;
  }, message, options, '✎');
}

/** A choice between named actions; resolves with the chosen key, or null. */
export function askChoice(message: string, choices: ReadonlyArray<{ readonly key: string; readonly label: string; readonly danger?: boolean }>, options: AskOptions = {}): Promise<string | null> {
  return open<string>((form, finish) => {
    const list = make('div', 'hz-ask-choices');
    for (const choice of choices) {
      const item = make('button', 'hz-ask-btn', choice.label);
      item.type = 'button';
      if (choice.danger) item.style.color = '#e5484d';
      item.addEventListener('click', () => finish(choice.key));
      list.append(item);
    }
    form.append(list);
    const row = make('div', 'hz-ask-actions');
    const cancel = make('button', 'hz-ask-btn', options.cancel ?? 'Vazgeç');
    cancel.type = 'button';
    cancel.addEventListener('click', () => finish(null));
    row.append(cancel);
    form.append(row);
    return list.querySelector('button');
  }, message, options, '☰');
}

/** alert(), in the theme. */
export async function tell(message: string, options: AskOptions = {}): Promise<void> {
  await open<boolean>((form, finish) => { actions(form, options, () => finish(true), () => finish(null), false); return null; }, message, options, 'i');
}

install();
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fitChatToEdges, { once: true });
  else fitChatToEdges();
}
// For the scripts that are not modules, and for the layer that replaces the server.
Object.assign(globalThis, { HafizeAsk: Object.freeze({ confirm: askConfirm, text: askText, choice: askChoice, tell, flash: flashFrame }) });
