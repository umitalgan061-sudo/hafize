// Chat scroll behaviour: auto-follow while the answer streams, a "jump to latest" button once the
// user scrolls up, and a themed thinking bubble that shows while a turn is in flight.
//
// The scroll container is #messages (it has overflow-y:auto), not the window — scrolling the window
// did nothing because the page itself never scrolls.
type Any = any;

const SCROLL_BUTTON_ID = 'chatScrollToBottom';
const THINKING_ID = 'chatThinking';
const STYLE_ID = 'chatScrollStyle';
const STYLE_PATH = '/chat-scroll.css';
// How close to the bottom (px) still counts as "following".
const BOTTOM_TOLERANCE = 80;
const THINKING_LABELS = Object.freeze(['Düşünüyor', 'Yazıyor', 'Araştırıyor', 'Yanıt hazırlıyor']);
// How long each label is shown before the next one.
const THINKING_LABEL_MS = 2600;

/**
 * True when a scroll container is at (or very near) its bottom. Pure, so it can be unit-tested
 * without a DOM: the caller passes the three metrics it already has.
 */
export function isAtBottom(metrics: { readonly scrollHeight: number; readonly scrollTop: number; readonly clientHeight: number }, tolerance = BOTTOM_TOLERANCE): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= tolerance;
}

/** Rotating label for the thinking bubble, so a long tool chain does not look frozen. */
export function thinkingLabelFor(elapsedMs: number, labels: readonly string[] = THINKING_LABELS): string {
  const index = Math.max(0, Math.floor(elapsedMs / THINKING_LABEL_MS)) % labels.length;
  return labels[index] ?? 'Düşünüyor';
}

function loadStyle(documentRef: Any): void {
  if (documentRef.getElementById(STYLE_ID)) return;
  const link = documentRef.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_PATH;
  documentRef.head.append(link);
}

/** True when the container is scrolled to (or very near) the bottom. */
function atBottom(container: Any): boolean {
  if (!container) return true;
  return isAtBottom(container);
}

export interface ChatScrollController {
  /** Scrolls to the latest content, respecting the user's scroll position. */
  follow(options?: { readonly force?: boolean }): void;
  /** Shows or hides the thinking bubble. */
  setThinking(active: boolean, label?: string): void;
  /** Re-evaluates the jump button and keeps the thinking bubble attached. */
  refresh(): void;
  /** Re-appends the thinking bubble as the last row of the message list. */
  attachTail(): void;
  refresh(): void;
  destroy(): void;
}

/** The strip above the message box where things that are going on are shown; made once, by whoever comes first. */
export function dockFor(doc: Any): Any {
  const existing = doc.getElementById('hafizeDock');
  if (existing) return existing;
  const composer = doc.getElementById('composer');
  if (!composer) return null;
  const dock = doc.createElement('div');
  dock.id = 'hafizeDock';
  dock.className = 'hz-dock';
  composer.append(dock);
  return dock;
}

export function mountChatScroll(options: { readonly messages: Any; readonly documentRef?: Any; readonly labelFor?: (index: number) => string }): ChatScrollController | null {
  const doc = options.documentRef ?? (typeof document !== 'undefined' ? document : null);
  const messages = options.messages;
  if (!doc || !messages) return null;

  loadStyle(doc);

  // The button lives inside the scroll container's parent so it can float over the messages.
  const host = messages.parentElement ?? messages;
  // .chat-stage is a flex column with position:static; without this the button anchors to the
  // viewport and sits in the page's bottom-right corner instead of above the composer.
  if (host && getComputedStyle(host).position === 'static') host.style.position = 'relative';
  let button = doc.getElementById(SCROLL_BUTTON_ID);
  if (!button) {
    button = doc.createElement('button');
    button.id = SCROLL_BUTTON_ID;
    button.type = 'button';
    button.className = 'chat-scroll-button';
    button.hidden = true;
    button.setAttribute('aria-label', 'Sohbetin en sonuna git');
    button.title = 'En son mesaja git';
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    button.addEventListener('click', () => { follow({ force: true }); messages.focus?.(); });
    host.append(button);
  }

  let thinking = doc.getElementById(THINKING_ID);
  if (!thinking) {
    thinking = doc.createElement('div');
    thinking.id = THINKING_ID;
    thinking.className = 'chat-thinking';
    thinking.hidden = true;
    thinking.setAttribute('aria-live', 'polite');
    thinking.innerHTML = '<span class="chat-thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="chat-thinking-label">Düşünüyor</span><span class="chat-thinking-time" aria-hidden="true"></span>';

  // renderMessages() wipes #messages with replaceChildren(), so the bubble is re-attached after
  // every render rather than being silently detached.
  }
  // The bubble stays in one place, just above the message box on the left, instead of riding the end of the chat up
  // and down. It shares that place with the background task line (hafize-uyum/src/background-panel.js).
  const dock = dockFor(doc);
  function attachTail(): void {
    const home = dock ?? messages;
    if (thinking.parentElement !== home) home.append(thinking);
  }

  // The user's own scroll always wins: while they are reading history the list stays put. Only the user stops the
  // following. A scroll event arrives a frame late, when the answer may already have grown past the bottom; read as
  // "not at the bottom" that used to switch following off by itself mid-answer, and the chat stayed stuck. So the list
  // stops following only when it is above the place it was last put, which content growing below cannot do.
  let following = true;
  let pinnedTop = 0;
  let frame = 0;
  let labelIndex = 0;
  let labelTimer: number | undefined;

  function pin(): void {
    messages.scrollTop = messages.scrollHeight;
    pinnedTop = messages.scrollTop;
  }
  function paintButton(): void {
    button.hidden = following;
  }
  // Text is painted a frame after it arrives, pictures load later still, and the keyboard changes the height:
  // each of these moves the bottom, so the list is put back there on the next frame while following.
  function schedule(): void {
    if (frame) return;
    const raf = (doc.defaultView ?? globalThis).requestAnimationFrame ?? ((callback: () => void) => setTimeout(callback, 16));
    frame = raf(() => { frame = 0; if (following) pin(); paintButton(); });
  }

  const onScroll = () => {
    if (atBottom(messages)) following = true;
    else if (messages.scrollTop < pinnedTop - 4) following = false;
    else if (following) schedule();
    paintButton();
  };
  messages.addEventListener('scroll', onScroll, { passive: true });
  const View = doc.defaultView ?? globalThis;
  const mutations = typeof View.MutationObserver === 'function' ? new View.MutationObserver(schedule) : null;
  mutations?.observe(messages, { childList: true, subtree: true, characterData: true });
  const resizes = typeof View.ResizeObserver === 'function' ? new View.ResizeObserver(schedule) : null;
  resizes?.observe(messages);
  // A picture's load does not bubble, so it is caught on the way down.
  messages.addEventListener('load', schedule, true);

  function follow({ force = false }: { readonly force?: boolean } = {}): void {
    if (force) following = true;
    if (!following) { paintButton(); return; }
    pin();
    schedule();
    paintButton();
  }

  // A clock beside the label, so a long tool chain shows it is moving: "Araştırıyor · 1 dk 4 sn".
  let clockTimer: number | undefined;
  let startedAt = 0;
  const paintClock = () => {
    const node = thinking.querySelector('.chat-thinking-time');
    if (!node) return;
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    node.textContent = seconds < 1 ? '' : seconds < 60 ? `${seconds} sn` : `${Math.floor(seconds / 60)} dk ${seconds % 60} sn`;
  };
  function setThinking(active: boolean, label?: string): void {
    if (!active) {
      thinking.hidden = true;
      if (labelTimer !== undefined) { clearInterval(labelTimer); labelTimer = undefined; }
      if (clockTimer !== undefined) { clearInterval(clockTimer); clockTimer = undefined; }
      doc.documentElement.classList.remove('hafize-working');
      return;
    }
    thinking.hidden = false;
    doc.documentElement.classList.add('hafize-working');
    if (clockTimer === undefined) { startedAt = Date.now(); paintClock(); clockTimer = setInterval(paintClock, 1000) as unknown as number; }
    schedule();
    const labelNode = thinking.querySelector('.chat-thinking-label');
    const labels = options.labelFor ? THINKING_LABELS.map((_, index) => options.labelFor!(index)) : [...THINKING_LABELS];
    if (labelNode) labelNode.textContent = label ?? labels[0] ?? 'Düşünüyor';
    if (labelTimer !== undefined) clearInterval(labelTimer);
    // Rotate the label so a long tool chain does not look frozen.
    labelTimer = setInterval(() => {
      labelIndex = (labelIndex + 1) % labels.length;
      const node = thinking.querySelector('.chat-thinking-label');
      if (node) node.textContent = labels[labelIndex];
    }, 2600) as unknown as number;
  }

  function refresh(): void {
    attachTail();
    if (following) { pin(); schedule(); }
    paintButton();
  }

  follow({ force: true });
  return Object.freeze({ follow, setThinking, refresh, attachTail, destroy: () => { if (clockTimer !== undefined) clearInterval(clockTimer); messages.removeEventListener('scroll', onScroll); messages.removeEventListener('load', schedule, true); mutations?.disconnect(); resizes?.disconnect(); button.remove(); thinking.remove(); if (labelTimer !== undefined) clearInterval(labelTimer); } });
}
