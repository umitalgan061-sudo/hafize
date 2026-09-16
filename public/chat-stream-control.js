/**
 * Composer controls for a streaming answer: stop it, or ask for another one.
 *
 * Until now a streaming answer ran to completion no matter what: the composer
 * was disabled, the request had no abort signal, and a wrong turn had to be
 * waited out. This module adds the two controls that fix that — `Durdur` while
 * the answer is streaming, `Yeniden üret` once it is not — and nothing else. It
 * owns no chat state and opens no connections: it asks `chat-stream-policy.js`
 * what to show, listens for `hafize:stream-state` from the chat runtime, and
 * sends `hafize:stop-stream` / `hafize:regenerate-answer` back. The runtime
 * remains the only thing that touches the transcript or the network.
 */
(function installChatStreamControl(root) {
  'use strict';

  const CONTROL_ID = 'chatStreamControl';
  const STOP_ID = 'stopStreamBtn';
  const REGENERATE_ID = 'regenerateAnswerBtn';
  const STREAMING_LABEL = 'Yanıt akıyor…';

  const policy = () => root.HafizeChatStreamPolicy ?? null;

  function button(doc, id, className, label, ariaLabel) {
    const node = doc.createElement('button');
    node.type = 'button';
    node.id = id;
    node.className = className;
    node.textContent = label;
    node.setAttribute('aria-label', ariaLabel);
    node.hidden = true;
    return node;
  }

  /** True while a modal panel owns Escape, so the shortcut stays out of its way. */
  function dialogOpen(doc) {
    const dialog = doc.querySelector('[role="dialog"]');
    return Boolean(dialog) && dialog.hidden !== true;
  }

  function mount(doc = root.document, view = root) {
    if (!doc || typeof view?.addEventListener !== 'function') return null;
    const existing = doc.getElementById(CONTROL_ID);
    if (existing) return existing.__hafizeStreamControl ?? null;

    const composer = doc.getElementById('composer');
    const actions = composer?.querySelector('.composer-actions');
    if (!actions) return null;

    const send = actions.querySelector('.send-btn');
    const input = doc.getElementById('messageInput');

    const group = doc.createElement('div');
    group.id = CONTROL_ID;
    group.className = 'chat-stream-control';

    const status = doc.createElement('span');
    status.className = 'chat-stream-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = '';

    const stop = button(doc, STOP_ID, 'icon-btn chat-stream-stop', '■ Durdur', 'Akan yanıtı durdur');
    const regenerate = button(
      doc,
      REGENERATE_ID,
      'icon-btn chat-stream-regenerate',
      '↻ Yeniden üret',
      'Son yanıtı yeniden üret'
    );

    group.append(status, stop, regenerate);
    if (send) actions.insertBefore(group, send);
    else actions.append(group);

    let current = { streaming: false, canStop: false, canRegenerate: false, stopped: false };

    const notify = (type) => {
      const Ctor = view.CustomEvent ?? root.CustomEvent;
      view.dispatchEvent(new Ctor(type, { bubbles: true, detail: { source: CONTROL_ID } }));
    };

    function apply(state) {
      current = {
        streaming: Boolean(state?.streaming),
        canStop: Boolean(state?.canStop),
        canRegenerate: Boolean(state?.canRegenerate),
        stopped: Boolean(state?.stopped)
      };

      stop.hidden = !current.streaming;
      stop.disabled = !current.canStop;
      regenerate.hidden = current.streaming || !current.canRegenerate;
      regenerate.disabled = !current.canRegenerate;
      if (send) send.hidden = current.streaming;

      if (current.streaming) status.textContent = STREAMING_LABEL;
      else if (current.stopped) status.textContent = policy()?.STOPPED_BADGE ?? 'Yanıt durduruldu';
      else status.textContent = '';

      // Hiding the focused control would drop focus to nowhere, so it moves to
      // whichever control replaced it.
      const focused = doc.activeElement;
      if (current.streaming && focused === send && !stop.disabled) stop.focus?.();
      else if (!current.streaming && focused === stop) (send ?? input)?.focus?.();
    }

    const onStateEvent = (event) => apply(event?.detail ?? {});

    const onStop = () => {
      if (!current.canStop) return;
      notify('hafize:stop-stream');
    };

    const onRegenerate = () => {
      if (!current.canRegenerate) return;
      notify('hafize:regenerate-answer');
    };

    const onKeydown = (event) => {
      if (event?.key !== 'Escape' || event.defaultPrevented) return;
      if (!current.canStop || dialogOpen(doc)) return;
      event.preventDefault();
      notify('hafize:stop-stream');
    };

    stop.addEventListener('click', onStop);
    regenerate.addEventListener('click', onRegenerate);
    view.addEventListener('hafize:stream-state', onStateEvent);
    doc.addEventListener('keydown', onKeydown);
    apply(current);

    const api = Object.freeze({
      mounted: true,
      element: group,
      stopButton: stop,
      regenerateButton: regenerate,
      statusElement: status,
      state: () => current,
      apply,
      destroy: () => {
        stop.removeEventListener('click', onStop);
        regenerate.removeEventListener('click', onRegenerate);
        view.removeEventListener('hafize:stream-state', onStateEvent);
        doc.removeEventListener('keydown', onKeydown);
        if (send) send.hidden = false;
        group.remove();
      }
    });
    group.__hafizeStreamControl = api;
    return api;
  }

  const api = Object.freeze({ CONTROL_ID, STOP_ID, REGENERATE_ID, STREAMING_LABEL, mount });
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeChatStreamControl = api;

  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else if (root.document) start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
