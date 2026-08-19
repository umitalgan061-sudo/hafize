(function exposeHafizeShortcutHelp(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeShortcutHelp = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeShortcutHelp() {
  'use strict';

  const DIALOG_ID = 'hafizeShortcutHelp';
  const BUTTON_ID = 'shortcutHelpBtn';
  const STYLE_ID = 'hafize-shortcut-help-style';
  const SHORTCUTS = Object.freeze([
    ['Ctrl/⌘ + K', 'Mesaj yazara odaklan'],
    ['Ctrl/⌘ + F', 'Aktif sohbette ara'],
    ['/', 'Mesaj yazara odaklan'],
    ['Esc', 'Üretilen yanıtı durdur'],
    ['↑ / ↓', 'Sohbet geçmişinde odak taşı'],
    ['Home / End', 'İlk / son görünür sohbete git'],
    ['?', 'Klavye kısayollarını göster']
  ]);
  const STYLE_TEXT = `
.shortcut-help-trigger{width:100%;margin-top:8px;border:1px solid var(--line,#ddd);border-radius:10px;background:transparent;color:inherit;padding:8px 10px;font:inherit;font-size:12px;cursor:pointer;text-align:left}
.shortcut-help-trigger:hover,.shortcut-help-trigger:focus-visible{background:color-mix(in srgb,var(--surface,#fff) 82%,transparent)}
.shortcut-help-trigger:focus-visible,.shortcut-help-close:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.shortcut-help-backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.42)}
.shortcut-help-backdrop[hidden]{display:none}
.shortcut-help-dialog{width:min(520px,100%);max-height:min(680px,calc(100vh - 36px));overflow:auto;border:1px solid var(--line,#ddd);border-radius:18px;background:var(--surface,#fff);color:inherit;box-shadow:0 24px 80px rgba(0,0,0,.24);padding:18px}
.shortcut-help-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.shortcut-help-head h2{margin:0;font-size:18px}
.shortcut-help-close{border:1px solid var(--line,#ddd);border-radius:9px;background:transparent;color:inherit;padding:6px 9px;font:inherit;cursor:pointer}
.shortcut-help-list{display:grid;gap:0;margin:0;padding:0;list-style:none}
.shortcut-help-row{display:grid;grid-template-columns:minmax(115px,.45fr) 1fr;gap:14px;align-items:center;padding:10px 2px;border-top:1px solid var(--line,#eee)}
.shortcut-help-row:first-child{border-top:0}
.shortcut-help-row kbd{justify-self:start;border:1px solid var(--line,#ddd);border-bottom-width:2px;border-radius:7px;background:color-mix(in srgb,var(--surface,#fff) 86%,#888 14%);padding:3px 7px;font:inherit;font-size:11px;white-space:nowrap}
.shortcut-help-note{margin:10px 0 0;color:var(--muted,#777);font-size:11px;line-height:1.45}
@media (max-width:520px){.shortcut-help-row{grid-template-columns:1fr;gap:5px}.shortcut-help-dialog{border-radius:15px;padding:15px}}
`;

  function isEditableTarget(target) {
    if (!target || typeof target !== 'object') return false;
    const tag = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (target.isContentEditable === true) return true;
    return Boolean(target.closest?.('[contenteditable="true"]'));
  }

  function isHelpShortcut(event) {
    return event?.key === '?' && event?.shiftKey === true
      && !event?.altKey && !event?.ctrlKey && !event?.metaKey;
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({ documentRef = globalThis.document } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.addEventListener !== 'function') {
      throw new Error('INVALID_SHORTCUT_HELP_DOCUMENT');
    }

    let mounted = false;
    let trigger = null;
    let backdrop = null;
    let dialog = null;
    let closeButton = null;
    let returnFocus = null;
    let ownsTrigger = false;
    let ownsBackdrop = false;
    let originalTriggerExpanded = null;
    let originalBackdropHidden = null;

    function createOwnedBackdrop() {
      const createdBackdrop = documentRef.createElement('div');
      createdBackdrop.id = DIALOG_ID;
      createdBackdrop.className = 'shortcut-help-backdrop';
      createdBackdrop.hidden = true;

      const createdDialog = documentRef.createElement('section');
      createdDialog.className = 'shortcut-help-dialog';
      createdDialog.setAttribute('role', 'dialog');
      createdDialog.setAttribute('aria-modal', 'true');
      createdDialog.setAttribute('aria-labelledby', `${DIALOG_ID}Title`);

      const head = documentRef.createElement('div');
      head.className = 'shortcut-help-head';
      const title = documentRef.createElement('h2');
      title.id = `${DIALOG_ID}Title`;
      title.textContent = 'Klavye kısayolları';
      const createdClose = documentRef.createElement('button');
      createdClose.type = 'button';
      createdClose.className = 'shortcut-help-close';
      createdClose.textContent = 'Kapat';
      createdClose.setAttribute('aria-label', 'Klavye kısayollarını kapat');
      head.append(title, createdClose);

      const list = documentRef.createElement('ul');
      list.className = 'shortcut-help-list';
      for (const [keys, label] of SHORTCUTS) {
        const row = documentRef.createElement('li');
        row.className = 'shortcut-help-row';
        const key = documentRef.createElement('kbd');
        key.textContent = keys;
        const text = documentRef.createElement('span');
        text.textContent = label;
        row.append(key, text);
        list.append(row);
      }
      const note = documentRef.createElement('p');
      note.className = 'shortcut-help-note';
      note.textContent = 'Kısayollar yazı alanındayken normal metin girişini bozmaz. Escape yalnız aktif yanıt veya bu pencere için kullanılır.';
      createdDialog.append(head, list, note);
      createdBackdrop.append(createdDialog);
      return { backdrop: createdBackdrop, dialog: createdDialog, closeButton: createdClose };
    }

    function createUi() {
      const footer = documentRef.querySelector('.sidebar-footer');
      if (!footer || !documentRef.body) return false;

      const existingBackdrop = documentRef.querySelector(`#${DIALOG_ID}`);
      if (existingBackdrop) {
        const existingDialog = existingBackdrop.querySelector?.('.shortcut-help-dialog');
        const existingClose = existingBackdrop.querySelector?.('.shortcut-help-close');
        if (!existingDialog || !existingClose) return false;
        backdrop = existingBackdrop;
        dialog = existingDialog;
        closeButton = existingClose;
        ownsBackdrop = false;
        originalBackdropHidden = Boolean(existingBackdrop.hidden);
      } else {
        const created = createOwnedBackdrop();
        backdrop = created.backdrop;
        dialog = created.dialog;
        closeButton = created.closeButton;
        documentRef.body.append(backdrop);
        ownsBackdrop = Boolean(backdrop.parentNode);
        originalBackdropHidden = null;
      }

      const existingTrigger = documentRef.querySelector(`#${BUTTON_ID}`);
      if (existingTrigger) {
        trigger = existingTrigger;
        ownsTrigger = false;
        originalTriggerExpanded = trigger.getAttribute?.('aria-expanded') ?? null;
      } else {
        trigger = documentRef.createElement('button');
        trigger.id = BUTTON_ID;
        trigger.type = 'button';
        trigger.className = 'shortcut-help-trigger';
        trigger.textContent = '⌨ Klavye kısayolları';
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-controls', DIALOG_ID);
        footer.prepend?.(trigger);
        ownsTrigger = Boolean(trigger.parentNode);
        originalTriggerExpanded = null;
      }
      return Boolean(trigger && backdrop && dialog && closeButton);
    }

    function restoreTriggerExpanded() {
      if (!trigger || ownsTrigger) return;
      if (originalTriggerExpanded === null || originalTriggerExpanded === undefined) trigger.removeAttribute?.('aria-expanded');
      else trigger.setAttribute?.('aria-expanded', originalTriggerExpanded);
    }

    function open(source = documentRef.activeElement) {
      if (!mounted || !backdrop || !closeButton || backdrop.hidden === false) return false;
      returnFocus = source && typeof source.focus === 'function' ? source : trigger;
      backdrop.hidden = false;
      trigger?.setAttribute?.('aria-expanded', 'true');
      closeButton.focus?.();
      return true;
    }

    function close({ restoreFocus = true } = {}) {
      if (!mounted || !backdrop || backdrop.hidden === true) return false;
      backdrop.hidden = true;
      trigger?.setAttribute?.('aria-expanded', 'false');
      if (restoreFocus) returnFocus?.focus?.();
      returnFocus = null;
      return true;
    }

    function focusableNodes() {
      if (!mounted) return [];
      return Array.from(dialog?.querySelectorAll?.('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') || [])
        .filter((node) => node.disabled !== true && node.hidden !== true);
    }

    function trapTab(event) {
      if (!mounted) return false;
      const nodes = focusableNodes();
      if (!nodes.length) return false;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault?.();
        last.focus?.();
        return true;
      }
      if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault?.();
        first.focus?.();
        return true;
      }
      return false;
    }

    function handleKeydown(event) {
      if (!mounted || !event || event.defaultPrevented || event.repeat) return false;
      if (backdrop?.hidden === false) {
        if (event.key === 'Escape') {
          event.preventDefault?.();
          event.stopPropagation?.();
          return close();
        }
        if (event.key === 'Tab') return trapTab(event);
        return false;
      }
      if (!isHelpShortcut(event) || isEditableTarget(event.target)) return false;
      event.preventDefault?.();
      return open(event.target);
    }

    function handleBackdrop(event) {
      if (!mounted || event?.target !== backdrop) return false;
      return close();
    }

    function handleTriggerClick() {
      return open(trigger);
    }

    function handleCloseClick() {
      return close();
    }

    function mount() {
      if (mounted) return true;
      if (!createUi()) return false;
      installStyles(documentRef);
      trigger.addEventListener('click', handleTriggerClick);
      closeButton.addEventListener('click', handleCloseClick);
      backdrop.addEventListener('click', handleBackdrop);
      documentRef.addEventListener('keydown', handleKeydown);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      if (backdrop?.hidden === false) close({ restoreFocus: false });
      mounted = false;
      documentRef.removeEventListener?.('keydown', handleKeydown);
      trigger?.removeEventListener?.('click', handleTriggerClick);
      closeButton?.removeEventListener?.('click', handleCloseClick);
      backdrop?.removeEventListener?.('click', handleBackdrop);
      if (ownsBackdrop) backdrop?.remove?.();
      else if (backdrop) backdrop.hidden = originalBackdropHidden;
      if (ownsTrigger) trigger?.remove?.();
      else restoreTriggerExpanded();
      trigger = null;
      backdrop = null;
      dialog = null;
      closeButton = null;
      returnFocus = null;
      ownsTrigger = false;
      ownsBackdrop = false;
      originalTriggerExpanded = null;
      originalBackdropHidden = null;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      open,
      close,
      handleKeydown,
      trapTab,
      snapshot: () => Object.freeze({ mounted, ownsTrigger, ownsBackdrop })
    });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({ SHORTCUTS, DIALOG_ID, BUTTON_ID, STYLE_ID, isEditableTarget, isHelpShortcut, installStyles, createController, mount });
});
