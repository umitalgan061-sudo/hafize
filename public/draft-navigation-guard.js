(function exposeHafizeDraftNavigationGuard(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeDraftNavigationGuard = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeDraftNavigationGuard() {
  'use strict';

  const STATUS_ID = 'draftNavigationGuardStatus';
  const MAX_DRAFT_CHARS = 12_000;
  const BLOCKED_LABEL = 'Gönderilmemiş taslak var. Önce gönder veya taslağı temizle.';

  function hasMeaningfulDraft(value) {
    return typeof value === 'string' && value.length <= MAX_DRAFT_CHARS && Boolean(value.trim());
  }

  function isConversationNavigationTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    if (target.closest('#newChatBtn')) return true;
    if (target.closest('#clearHistoryBtn')) return true;
    if (target.closest('.conversation-open')) return true;
    const remove = target.closest('.conversation-delete');
    return Boolean(remove?.closest?.('.conversation-row')?.classList?.contains('active'));
  }

  function createController({ documentRef = globalThis.document } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_DRAFT_NAVIGATION_GUARD_DOCUMENT');
    }

    let mounted = false;
    let status = null;

    function nodes() {
      return Object.freeze({
        input: documentRef.querySelector('#messageInput'),
        composer: documentRef.querySelector('#composer')
      });
    }

    function ensureStatus(composer) {
      const existing = documentRef.querySelector(`#${STATUS_ID}`);
      if (existing) return existing;
      const node = documentRef.createElement('p');
      node.id = STATUS_ID;
      node.className = 'agent-hint draft-navigation-guard-status';
      node.hidden = true;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      composer.append(node);
      return node;
    }

    function clearStatus() {
      if (!status) return;
      status.hidden = true;
      status.textContent = '';
    }

    function showBlocked(input) {
      if (status) {
        status.textContent = BLOCKED_LABEL;
        status.hidden = false;
      }
      input?.focus?.();
    }

    function onCaptureClick(event) {
      if (event.defaultPrevented || !isConversationNavigationTarget(event.target)) return;
      const { input } = nodes();
      if (!hasMeaningfulDraft(input?.value)) {
        clearStatus();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation?.();
      showBlocked(input);
    }

    function onInput() {
      const { input } = nodes();
      if (!hasMeaningfulDraft(input?.value)) clearStatus();
    }

    function mount() {
      if (mounted) return false;
      const { input, composer } = nodes();
      if (!input || !composer || typeof documentRef.addEventListener !== 'function') return false;
      status = ensureStatus(composer);
      documentRef.addEventListener('click', onCaptureClick, true);
      input.addEventListener?.('input', onInput);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      const { input } = nodes();
      documentRef.removeEventListener?.('click', onCaptureClick, true);
      input?.removeEventListener?.('input', onInput);
      status?.remove?.();
      status = null;
      mounted = false;
      return true;
    }

    return Object.freeze({ mount, destroy, onCaptureClick, clearStatus });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    STATUS_ID,
    MAX_DRAFT_CHARS,
    BLOCKED_LABEL,
    hasMeaningfulDraft,
    isConversationNavigationTarget,
    createController,
    mount
  });
});
