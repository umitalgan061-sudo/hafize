(function exposeHafizeChatRunController(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeChatRunController = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeChatRunControllerApi() {
  'use strict';

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  function createChatRunController({ AbortControllerImpl = globalThis.AbortController } = {}) {
    if (typeof AbortControllerImpl !== 'function') fail('CHAT_RUN_ABORT_UNAVAILABLE');

    let active = null;
    let generation = 0;

    function snapshot() {
      return Object.freeze({
        active: active !== null,
        generation: active?.generation ?? generation,
        aborted: Boolean(active?.controller.signal.aborted)
      });
    }

    function begin() {
      if (active !== null) fail('CHAT_RUN_ALREADY_ACTIVE');
      generation += 1;
      const controller = new AbortControllerImpl();
      if (!controller?.signal || typeof controller.abort !== 'function') fail('CHAT_RUN_ABORT_UNAVAILABLE');
      const token = Object.freeze({ generation });
      active = { generation, controller, token };
      return Object.freeze({ token, signal: controller.signal });
    }

    function abort(reason = 'user') {
      if (active === null) return false;
      if (active.controller.signal.aborted) return false;
      active.controller.abort(reason);
      return true;
    }

    function finish(token) {
      if (active === null || token !== active.token) return false;
      active = null;
      return true;
    }

    function isCurrent(token) {
      return active !== null && token === active.token;
    }

    return Object.freeze({ begin, abort, finish, isCurrent, snapshot });
  }

  function isAbortError(error, signal) {
    return Boolean(signal?.aborted || error?.name === 'AbortError' || error?.code === 'ABORT_ERR');
  }

  return Object.freeze({ createChatRunController, isAbortError });
});
