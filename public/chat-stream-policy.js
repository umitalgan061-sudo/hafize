(function exposeChatStreamPolicy(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeChatStreamPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createChatStreamPolicy() {
  'use strict';

  // Shared rules for stopping a streaming answer and for regenerating the last
  // one. The chat runtime (`app.js`) owns the network and the transcript; the
  // composer controls (`chat-stream-control.js`) own the buttons. Both ask this
  // module the same questions, so "can I stop?" and "can I regenerate?" have a
  // single answer that a suite can exercise without a DOM or a server.

  const STOPPED_NOTE = 'Yanıt durduruldu.';
  const STOPPED_BADGE = 'Yanıt durduruldu';

  function isAbortError(error) {
    if (!error) return false;
    if (error.name === 'AbortError') return true;
    // Some runtimes reject a read on an aborted body with a plain DOMException
    // carrying only a code, so the name check alone is not enough.
    return error.code === 20 || error.code === 'ABORT_ERR';
  }

  function isAssistant(message) {
    return Boolean(message) && message.role === 'assistant';
  }

  function hasContent(message) {
    return typeof message?.content === 'string' && message.content.trim() !== '';
  }

  /**
   * The answer a regenerate would replace: the transcript's last message, when
   * it is an assistant turn that some user turn asked for. An answer that was
   * stopped or that failed still qualifies — retrying those is the point.
   */
  function findLastAnswer(messages) {
    const list = Array.isArray(messages) ? messages : [];
    const index = list.length - 1;
    const message = list[index];
    if (!isAssistant(message)) return null;
    const asked = list.slice(0, index).some((item) => item?.role === 'user' && hasContent(item));
    if (!asked) return null;
    return { index, message };
  }

  function canRegenerate(messages) {
    return findLastAnswer(messages) !== null;
  }

  /** Transcript with the last answer dropped, ready for a fresh turn. */
  function truncateForRegenerate(messages) {
    const target = findLastAnswer(messages);
    if (!target) return null;
    return messages.slice(0, target.index);
  }

  /**
   * What the composer controls should show. `hasActiveStream` is false in the
   * window between "the user pressed send" and "a request is in flight", and
   * stopping needs something to abort, so it gates the stop button separately.
   */
  function describeState({ streaming = false, hasActiveStream = false, messages = [] } = {}) {
    const active = Boolean(streaming);
    const last = Array.isArray(messages) ? messages[messages.length - 1] : null;
    return Object.freeze({
      streaming: active,
      canStop: active && Boolean(hasActiveStream),
      canRegenerate: !active && canRegenerate(messages),
      stopped: !active && isAssistant(last) && Boolean(last?.stopped)
    });
  }

  /**
   * Text to persist for an answer the user stopped. A partial answer is kept
   * verbatim — it is what the model actually said — and only an empty one is
   * replaced by the note, so the transcript never shows a blank turn.
   */
  function stoppedContent(content) {
    const value = typeof content === 'string' ? content : '';
    return value.trim() === '' ? STOPPED_NOTE : value;
  }

  return Object.freeze({
    STOPPED_NOTE,
    STOPPED_BADGE,
    isAbortError,
    findLastAnswer,
    canRegenerate,
    truncateForRegenerate,
    describeState,
    stoppedContent
  });
});
