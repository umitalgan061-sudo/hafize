(function exposeHafizeChatMarkdown(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeChatMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeChatMarkdown(root) {
  'use strict';

  const COPY_FEEDBACK_MS = 1400;

  // A streaming answer calls `paint()` once per SSE delta. Re-parsing on every
  // delta would rebuild the DOM hundreds of times a second, so paints are
  // coalesced into one animation frame and only the newest text survives.
  const pendingPaints = new WeakMap();
  const scheduledFrames = new WeakMap();

  function markdown() {
    const api = root.HafizeMarkdown;
    return api && typeof api.renderMarkdownInto === 'function' ? api : null;
  }

  /**
   * Only an assistant answer is markdown: a user message is shown exactly as it
   * was typed, and a caller that passes a role but no explicit `plain` flag still
   * gets that rule applied instead of an accidental markdown pass.
   */
  function isPlain(options) {
    if (options.plain !== undefined) return Boolean(options.plain);
    return options.role !== undefined && options.role !== 'assistant';
  }

  function flushPaint(container) {
    const job = pendingPaints.get(container);
    if (!job) return null;
    pendingPaints.delete(container);
    const api = markdown();
    const { text, options } = job;
    if (!api || isPlain(options)) {
      if (api) return api.renderPlainInto(container, text, options) ? { rendered: false } : null;
      container.textContent = text || options.placeholder || '';
      return { rendered: false };
    }
    return api.renderMarkdownInto(container, text, options);
  }

  function cancelFrame(container) {
    const handle = scheduledFrames.get(container);
    if (handle === undefined) return;
    scheduledFrames.delete(container);
    if (typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(handle);
  }

  function scheduleFrame(container) {
    if (scheduledFrames.has(container)) return;
    if (typeof root.requestAnimationFrame !== 'function') {
      flushPaint(container);
      return;
    }
    const handle = root.requestAnimationFrame(() => {
      scheduledFrames.delete(container);
      flushPaint(container);
    });
    scheduledFrames.set(container, handle);
  }

  /**
   * Writes an answer into a `.content` node.
   * `streaming: true` coalesces into the next frame; every other call paints
   * straight away and cancels a frame that is still pending, so the final
   * text can never be overwritten by an older delta.
   */
  function paint(container, text, options = {}) {
    if (!container) return null;
    pendingPaints.set(container, { text: typeof text === 'string' ? text : '', options });
    if (options.streaming) {
      // The message list is an `aria-live` log. Rebuilding the answer on every
      // frame would make a screen reader read the whole thing again and again,
      // so the node is marked busy until the answer is final.
      container.setAttribute?.('aria-busy', 'true');
      scheduleFrame(container);
      return null;
    }
    cancelFrame(container);
    const result = flushPaint(container);
    container.removeAttribute?.('aria-busy');
    return result;
  }

  /** The markdown source behind a painted container, for copy actions. */
  function sourceFor(container) {
    const api = root.HafizeMarkdown;
    const source = typeof api?.sourceFor === 'function' ? api.sourceFor(container) : '';
    return source || container?.textContent || '';
  }

  /**
   * A painted answer as readable plain text, with its line breaks kept.
   * Callers that used to read `.content.textContent` use this instead, because
   * rendered block elements concatenate without separators.
   */
  function plainTextFor(container) {
    const api = root.HafizeMarkdown;
    if (typeof api?.toPlainText === 'function' && typeof api?.sourceFor === 'function') {
      const text = api.toPlainText(api.sourceFor(container));
      if (text) return text;
    }
    return container?.textContent ?? '';
  }

  function codeTextFor(button) {
    const block = button?.closest?.('.md-code');
    return block?.querySelector?.('.md-code-body code')?.textContent ?? '';
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      if (root.navigator?.clipboard?.writeText) {
        await root.navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to the legacy path below.
    }
    const documentRef = root.document;
    if (!documentRef?.body) return false;
    const helper = documentRef.createElement('textarea');
    helper.value = text;
    helper.setAttribute('aria-hidden', 'true');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    documentRef.body.append(helper);
    helper.select();
    let copied = false;
    try {
      copied = documentRef.execCommand('copy');
    } catch {
      copied = false;
    }
    helper.remove();
    return copied;
  }

  function markCopyState(button, state) {
    button.setAttribute('data-state', state);
    root.clearTimeout?.(Number(button.dataset.resetHandle));
    const handle = root.setTimeout?.(() => button.setAttribute('data-state', 'idle'), COPY_FEEDBACK_MS);
    if (handle !== undefined) button.dataset.resetHandle = String(handle);
  }

  async function handleCopyClick(event) {
    const button = event.target?.closest?.('[data-md-copy="code"]');
    if (!button) return;
    event.preventDefault();
    markCopyState(button, (await copyText(codeTextFor(button))) ? 'copied' : 'failed');
  }

  function init(messagesNode) {
    const node = messagesNode ?? root.document?.querySelector?.('#messages');
    if (!node || node.dataset?.mdCopyBound === 'true') return false;
    node.addEventListener('click', handleCopyClick);
    if (node.dataset) node.dataset.mdCopyBound = 'true';
    return true;
  }

  /**
   * Code copy is delegated from `#messages`, so the binding is lost whenever that
   * node is replaced — a conversation switch rebuilds the list. A MutationObserver
   * re-binds the fresh node instead of leaving dead copy buttons behind. `init()`
   * is idempotent through the `mdCopyBound` flag, so re-running it is free.
   */
  function watch(documentRef = root.document) {
    const target = documentRef?.body;
    if (!target || typeof root.MutationObserver !== 'function') return null;
    const observer = new root.MutationObserver(() => { init(); });
    observer.observe(target, { childList: true, subtree: true });
    return observer;
  }

  if (root.document?.querySelector) {
    init();
    watch();
  }

  return Object.freeze({ paint, isPlain, sourceFor, plainTextFor, copyText, codeTextFor, init, watch, COPY_FEEDBACK_MS });
});
