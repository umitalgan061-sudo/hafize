(function exposeHafizeChatRunController(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeChatRunController = api;
  api.installSseIntegrity(root);

  const documentRef = root.document;
  function loadShellEnhancement(globalName, path, marker) {
    if (!documentRef?.head || root[globalName] || documentRef.querySelector(`script[${marker}]`)) return;
    const script = documentRef.createElement('script');
    script.src = path;
    script.defer = true;
    script.setAttribute(marker, '1');
    documentRef.head.append(script);
  }
  loadShellEnhancement('HafizeMessageCopy', '/message-copy.js', 'data-hafize-message-copy');
  loadShellEnhancement('HafizeMessageEdit', '/message-edit.js', 'data-hafize-message-edit');
  loadShellEnhancement('HafizeKeyboardShortcuts', '/keyboard-shortcuts.js', 'data-hafize-keyboard-shortcuts');
  loadShellEnhancement('HafizeConversationSearch', '/conversation-search.js', 'data-hafize-conversation-search');
  loadShellEnhancement('HafizeScrollToLatest', '/scroll-to-latest.js', 'data-hafize-scroll-to-latest');
  loadShellEnhancement('HafizeComposerLimitFeedback', '/composer-limit-feedback.js', 'data-hafize-composer-limit-feedback');
  loadShellEnhancement('HafizeMobileSidebarDismiss', '/mobile-sidebar-dismiss.js', 'data-hafize-mobile-sidebar-dismiss');
  loadShellEnhancement('HafizeDraftClearUndo', '/draft-clear-undo.js', 'data-hafize-draft-clear-undo');
  loadShellEnhancement('HafizeDraftNavigationGuard', '/draft-navigation-guard.js', 'data-hafize-draft-navigation-guard');
  loadShellEnhancement('HafizeConversationKeyboardNav', '/conversation-keyboard-nav.js', 'data-hafize-conversation-keyboard-nav');
  loadShellEnhancement('HafizeConversationDeleteConfirm', '/conversation-delete-confirm.js', 'data-hafize-conversation-delete-confirm');
  loadShellEnhancement('HafizeShortcutHelp', '/shortcut-help.js', 'data-hafize-shortcut-help');
  loadShellEnhancement('HafizeNetworkStatus', '/network-status.js', 'data-hafize-network-status');
  loadShellEnhancement('HafizeConversationCopy', '/conversation-copy.js', 'data-hafize-conversation-copy');
  loadShellEnhancement('HafizeInChatFind', '/in-chat-find.js', 'data-hafize-in-chat-find');
  loadShellEnhancement('HafizeSafeMarkdown', '/safe-markdown-render.js', 'data-hafize-safe-markdown');
  loadShellEnhancement('HafizeCodeBlockCopy', '/code-block-copy.js', 'data-hafize-code-block-copy');
  loadShellEnhancement('HafizeConversationExport', '/conversation-export.js', 'data-hafize-conversation-export');
  loadShellEnhancement('HafizeResponseFold', '/response-fold.js', 'data-hafize-response-fold');
  loadShellEnhancement('HafizeCodeBlockFocus', '/code-block-focus.js', 'data-hafize-code-block-focus');
  loadShellEnhancement('HafizeComposerHistory', '/composer-history.js', 'data-hafize-composer-history');
  loadShellEnhancement('HafizeCodeBlockDownload', '/code-block-download.js', 'data-hafize-code-block-download');
  loadShellEnhancement('HafizeTextFileImportStyle', '/text-file-import-style.js', 'data-hafize-text-file-import-style-loader');
  loadShellEnhancement('HafizeTextFileImport', '/text-file-import.js', 'data-hafize-text-file-import');
  loadShellEnhancement('HafizeComposerPasteGuard', '/composer-paste-guard.js', 'data-hafize-composer-paste-guard');
  loadShellEnhancement('HafizeMessageTimeline', '/message-timeline.js', 'data-hafize-message-timeline');
  loadShellEnhancement('HafizeMessageKeyboardNav', '/message-keyboard-nav.js', 'data-hafize-message-keyboard-nav');
  loadShellEnhancement('HafizeModelSelectorEnhancement', '/model-selector-enhancement.js', 'data-hafize-model-selector-enhancement');
  loadShellEnhancement('HafizeResponseProgress', '/response-progress.js', 'data-hafize-response-progress');
  loadShellEnhancement('HafizeConversationModelState', '/conversation-model-state.js', 'data-hafize-conversation-model-state');
  loadShellEnhancement('HafizeScheduleRuntimeStyle', '/schedule-runtime-status-style.js', 'data-hafize-schedule-runtime-style-loader');
  loadShellEnhancement('HafizeScheduleRuntimeStatus', '/schedule-runtime-status.js', 'data-hafize-schedule-runtime-status');
  loadShellEnhancement('HafizeScheduleList', '/schedule-list.js', 'data-hafize-schedule-list');
  loadShellEnhancement('HafizeScheduleCreate', '/schedule-create.js', 'data-hafize-schedule-create');
  loadShellEnhancement('HafizeScheduleCancel', '/schedule-cancel.js', 'data-hafize-schedule-cancel');
  loadShellEnhancement('HafizeScheduleReschedule', '/schedule-reschedule.js', 'data-hafize-schedule-reschedule');
  loadShellEnhancement('HafizeScheduleRetryPolicy', '/schedule-retry-policy.js', 'data-hafize-schedule-retry-policy');
  loadShellEnhancement('HafizeDesktopDeviceStatus', '/desktop-device-status.js', 'data-hafize-desktop-device-status');
  loadShellEnhancement('HafizeGitHubWriteReadinessStyle', '/github-write-readiness-style.js', 'data-hafize-github-write-readiness-style-loader');
  loadShellEnhancement('HafizeGitHubWriteReadiness', '/github-write-readiness.js', 'data-hafize-github-write-readiness');
  loadShellEnhancement('HafizeGitHubBranchCreateStyle', '/github-branch-create-style.js', 'data-hafize-github-branch-create-style-loader');
  loadShellEnhancement('HafizeGitHubBranchCreate', '/github-branch-create.js', 'data-hafize-github-branch-create');
  loadShellEnhancement('HafizeGitHubDraftPrCreateStyle', '/github-draft-pr-create-style.js', 'data-hafize-github-draft-pr-create-style-loader');
  loadShellEnhancement('HafizeGitHubDraftPrCreate', '/github-draft-pr-create.js', 'data-hafize-github-draft-pr-create');
  loadShellEnhancement('HafizeGitHubFileUpdateStyle', '/github-file-update-style.js', 'data-hafize-github-file-update-style-loader');
  loadShellEnhancement('HafizeGitHubFileUpdate', '/github-file-update.js', 'data-hafize-github-file-update');
  loadShellEnhancement('HafizeGitHubWriteActivityStyle', '/github-write-activity-style.js', 'data-hafize-github-write-activity-style-loader');
  loadShellEnhancement('HafizeGitHubWriteActivity', '/github-write-activity.js', 'data-hafize-github-write-activity');
  loadShellEnhancement('HafizeGitHubPrMergeStyle', '/github-pr-merge-style.js', 'data-hafize-github-pr-merge-style-loader');
  loadShellEnhancement('HafizeGitHubPrMerge', '/github-pr-merge.js', 'data-hafize-github-pr-merge');
  loadShellEnhancement('HafizeResponseRetryStyle', '/response-retry-style.js', 'data-hafize-response-retry-style-loader');
  loadShellEnhancement('HafizeResponseRetry', '/response-retry.js', 'data-hafize-response-retry');
  loadShellEnhancement('HafizeReadingFocus', '/reading-focus.js', 'data-hafize-reading-focus');
  loadShellEnhancement('HafizeConversationOutline', '/conversation-outline.js', 'data-hafize-conversation-outline');
  loadShellEnhancement('HafizeConversationOrganize', '/conversation-organize.js', 'data-hafize-conversation-organize');
  loadShellEnhancement('HafizeCanvaConnectionStatusStyle', '/canva-connection-status-style.js', 'data-hafize-canva-connection-status-style-loader');
  loadShellEnhancement('HafizeCanvaConnectionStatus', '/canva-connection-status.js', 'data-hafize-canva-connection-status');
  loadShellEnhancement('HafizeCanvaSessionSync', '/canva-session-sync.js', 'data-hafize-canva-session-sync');
  loadShellEnhancement('HafizeGmailWorkspaceStyle', '/gmail-workspace-style.js', 'data-hafize-gmail-workspace-style-loader');
  loadShellEnhancement('HafizeGmailWorkspace', '/gmail-workspace.js', 'data-hafize-gmail-workspace');
  loadShellEnhancement('HafizeMemoryConsentReview', '/memory-consent-review.js', 'data-hafize-memory-consent-review');
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeChatRunControllerApi() {
  'use strict';

  const SSE_STREAM_PATHS = Object.freeze(['/api/chat', '/api/agent/run']);
  const MAX_SSE_PENDING_CHARS = 256 * 1024;
  const SSE_FETCH_MARKER = Symbol.for('hafize.sse.integrity.fetch.v1');

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  function requestMethod(input, init) {
    const value = init?.method ?? input?.method ?? 'GET';
    return String(value || 'GET').toUpperCase();
  }

  function requestUrl(input) {
    if (typeof input === 'string' || input instanceof URL) return String(input);
    return typeof input?.url === 'string' ? input.url : '';
  }

  function shouldGuardSseRequest(input, init, origin) {
    if (requestMethod(input, init) !== 'POST' || typeof origin !== 'string' || !origin) return false;
    const raw = requestUrl(input);
    if (!raw) return false;
    try {
      const parsed = new URL(raw, origin);
      return parsed.origin === origin && SSE_STREAM_PATHS.includes(parsed.pathname) && !parsed.search && !parsed.hash;
    } catch {
      return false;
    }
  }

  function isEventStreamResponse(response) {
    if (!response?.body || typeof response.headers?.get !== 'function') return false;
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    return type.split(';', 1)[0].trim() === 'text/event-stream';
  }

  function createSseFrameNormalizer({ maxPendingChars = MAX_SSE_PENDING_CHARS } = {}) {
    if (!Number.isSafeInteger(maxPendingChars) || maxPendingChars < 1024 || maxPendingChars > MAX_SSE_PENDING_CHARS) {
      fail('INVALID_SSE_PENDING_LIMIT');
    }
    let pending = '';
    let trailingCr = '';
    let closed = false;

    function appendNormalized(text) {
      if (typeof text !== 'string') fail('INVALID_SSE_CHUNK');
      let combined = `${trailingCr}${text}`;
      trailingCr = '';
      if (combined.endsWith('\r')) {
        trailingCr = '\r';
        combined = combined.slice(0, -1);
      }
      pending += combined.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    function drain() {
      const frames = [];
      while (true) {
        const boundary = pending.indexOf('\n\n');
        if (boundary < 0) break;
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        if (frame.length > maxPendingChars) fail('SSE_FRAME_TOO_LARGE');
        frames.push(`${frame}\n\n`);
      }
      if (pending.length + trailingCr.length > maxPendingChars) fail('SSE_FRAME_TOO_LARGE');
      return frames;
    }

    function push(text) {
      if (closed) fail('SSE_NORMALIZER_CLOSED');
      appendNormalized(text);
      return drain();
    }

    function finish(text = '') {
      if (closed) fail('SSE_NORMALIZER_CLOSED');
      appendNormalized(text);
      if (trailingCr) {
        pending += '\n';
        trailingCr = '';
      }
      const frames = drain();
      if (pending) frames.push(pending.endsWith('\n') ? `${pending}\n` : `${pending}\n\n`);
      pending = '';
      closed = true;
      return frames;
    }

    function snapshot() {
      return Object.freeze({ pendingChars: pending.length + trailingCr.length, closed });
    }

    return Object.freeze({ push, finish, snapshot });
  }

  function createNormalizedSseResponse(response, root, { maxPendingChars = MAX_SSE_PENDING_CHARS } = {}) {
    if (!isEventStreamResponse(response)) return response;
    const HeadersImpl = root?.Headers || globalThis.Headers;
    if (typeof root?.TransformStream !== 'function' || typeof root?.TextDecoder !== 'function' || typeof root?.TextEncoder !== 'function' || typeof root?.Response !== 'function' || typeof HeadersImpl !== 'function') {
      return response;
    }
    const normalizer = createSseFrameNormalizer({ maxPendingChars });
    const decoder = new root.TextDecoder();
    const encoder = new root.TextEncoder();
    const transform = new root.TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk || new Uint8Array(), { stream: true });
        for (const frame of normalizer.push(text)) controller.enqueue(encoder.encode(frame));
      },
      flush(controller) {
        const tail = decoder.decode();
        for (const frame of normalizer.finish(tail)) controller.enqueue(encoder.encode(frame));
      }
    });
    const headers = new HeadersImpl(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new root.Response(response.body.pipeThrough(transform), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  function installSseIntegrity(root = globalThis) {
    if (!root || typeof root.fetch !== 'function') return null;
    if (root.fetch[SSE_FETCH_MARKER]) return root.fetch[SSE_FETCH_MARKER];
    const originalFetch = root.fetch.bind(root);
    const origin = typeof root.location?.origin === 'string' ? root.location.origin : '';

    async function guardedFetch(input, init) {
      const shouldGuard = shouldGuardSseRequest(input, init, origin);
      const response = await originalFetch(input, init);
      if (!shouldGuard || !isEventStreamResponse(response)) return response;
      return createNormalizedSseResponse(response, root);
    }

    const controller = Object.freeze({
      originalFetch,
      restore() {
        if (root.fetch === guardedFetch) root.fetch = originalFetch;
      }
    });
    Object.defineProperty(guardedFetch, SSE_FETCH_MARKER, { value: controller });
    root.fetch = guardedFetch;
    return controller;
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

  return Object.freeze({
    SSE_STREAM_PATHS,
    MAX_SSE_PENDING_CHARS,
    requestMethod,
    requestUrl,
    shouldGuardSseRequest,
    isEventStreamResponse,
    createSseFrameNormalizer,
    createNormalizedSseResponse,
    installSseIntegrity,
    createChatRunController,
    isAbortError
  });
});
