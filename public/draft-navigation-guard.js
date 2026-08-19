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
    let mountedInput = null;
    let status = null;
    let statusOwned = false;
    let statusSnapshot = null;

    function nodes() {
      return Object.freeze({
        input: documentRef.querySelector('#messageInput'),
        composer: documentRef.querySelector('#composer')
      });
    }

    function acquireStatus(composer) {
      const existing = documentRef.querySelector(`#${STATUS_ID}`);
      if (existing) return Object.freeze({ node: existing, owned: false });
      const node = documentRef.createElement('p');
      node.id = STATUS_ID;
      node.className = 'agent-hint draft-navigation-guard-status';
      node.hidden = true;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      composer.append(node);
      return Object.freeze({ node, owned: true });
    }

    function snapshotStatus(node) {
      if (!node) return null;
      return Object.freeze({ hidden: Boolean(node.hidden), textContent: String(node.textContent || '') });
    }

    function restoreStatus() {
      if (!status) return;
      if (statusOwned) {
        status.remove?.();
        return;
      }
      if (!statusSnapshot) return;
      status.hidden = statusSnapshot.hidden;
      status.textContent = statusSnapshot.textContent;
    }

    function clearStatus() {
      if (!status) return false;
      status.hidden = true;
      status.textContent = '';
      return true;
    }

    function showBlocked(input) {
      if (!mounted) return false;
      if (status) {
        status.textContent = BLOCKED_LABEL;
        status.hidden = false;
      }
      input?.focus?.();
      return true;
    }

    function onCaptureClick(event) {
      if (!mounted || event?.defaultPrevented || !isConversationNavigationTarget(event?.target)) return false;
      const input = mountedInput;
      if (!hasMeaningfulDraft(input?.value)) {
        clearStatus();
        return false;
      }
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      showBlocked(input);
      return true;
    }

    function onInput() {
      if (!mounted) return false;
      if (!hasMeaningfulDraft(mountedInput?.value)) return clearStatus();
      return false;
    }

    function mount() {
      if (mounted) return false;
      const { input, composer } = nodes();
      if (!input || !composer || typeof documentRef.addEventListener !== 'function') return false;
      const acquired = acquireStatus(composer);
      status = acquired.node;
      statusOwned = acquired.owned;
      statusSnapshot = statusOwned ? null : snapshotStatus(status);
      mountedInput = input;
      documentRef.addEventListener('click', onCaptureClick, true);
      mountedInput.addEventListener?.('input', onInput);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      documentRef.removeEventListener?.('click', onCaptureClick, true);
      mountedInput?.removeEventListener?.('input', onInput);
      mountedInput = null;
      restoreStatus();
      status = null;
      statusOwned = false;
      statusSnapshot = null;
      return true;
    }

    function snapshot() {
      return Object.freeze({ mounted, statusOwned, hasMountedInput: Boolean(mountedInput) });
    }

    return Object.freeze({ mount, destroy, snapshot, onCaptureClick, onInput, clearStatus });
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
