(function exposeHafizeCommandPalette(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeCommandPalette = api;
  api.mount({ documentRef: root.document });
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeCommandPalette() {
  'use strict';

  const STYLE_ID = 'hafize-command-palette-style';
  const COMMANDS = Object.freeze([
    Object.freeze({ id: 'focus-composer', label: 'Mesaj alanına git', hint: 'Yazmaya devam et', selector: '#messageInput', action: 'focus' }),
    Object.freeze({ id: 'new-chat', label: 'Yeni sohbet', hint: 'Boş bir konuşma aç', selector: '#newChatBtn', action: 'click' }),
    Object.freeze({ id: 'toggle-theme', label: 'Temayı değiştir', hint: 'Açık / koyu görünüm', selector: '#themeToggle', action: 'click' }),
    Object.freeze({ id: 'toggle-sidebar', label: 'Yan menüyü aç / kapat', hint: 'Sohbet geçmişini göster', selector: '#sidebarToggle', action: 'click' }),
    Object.freeze({ id: 'voice-input', label: 'Sesli girişi aç / kapat', hint: 'Mikrofon kontrolü', selector: '#micBtn', action: 'click' }),
    Object.freeze({ id: 'scroll-latest', label: 'Son mesaja git', hint: 'Sohbetin en altına geç', selector: '#messages', action: 'scroll-end' })
  ]);

  const STYLE_TEXT = `
.hafize-command-palette-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:start center;padding:12vh 18px;background:color-mix(in srgb,#111 34%,transparent);backdrop-filter:blur(3px)}
.hafize-command-palette-backdrop[hidden]{display:none}
.hafize-command-palette{width:min(620px,100%);max-height:min(70vh,560px);overflow:hidden;border:1px solid var(--line,#ddd);border-radius:18px;background:var(--surface,#fff);box-shadow:0 24px 70px rgba(0,0,0,.22)}
.hafize-command-palette input{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--line,#ddd);background:transparent;color:inherit;padding:16px 18px;font:inherit;font-size:15px;outline:none}
.hafize-command-list{display:grid;gap:4px;max-height:430px;overflow:auto;padding:8px}
.hafize-command-item{display:grid;grid-template-columns:1fr auto;gap:12px;width:100%;border:0;border-radius:12px;background:transparent;color:inherit;padding:11px 12px;text-align:left;font:inherit;cursor:pointer}
.hafize-command-item:hover,.hafize-command-item[aria-selected="true"]{background:color-mix(in srgb,var(--surface,#fff) 82%,var(--line,#ddd))}
.hafize-command-item strong{font-size:13px}.hafize-command-item small{color:var(--premium-muted,#777);font-size:11px}
.hafize-command-empty{padding:18px;color:var(--premium-muted,#777);text-align:center;font-size:12px}
@media(max-width:720px){.hafize-command-palette-backdrop{padding-top:8vh}.hafize-command-palette{border-radius:16px}.hafize-command-item{min-height:44px}}
`;

  function isOpenShortcut(event) {
    return String(event?.key || '').toLowerCase() === 'p'
      && Boolean(event?.ctrlKey || event?.metaKey)
      && Boolean(event?.shiftKey)
      && !event?.altKey;
  }

  function normalizeQuery(value) {
    return typeof value === 'string' ? value.trim().toLocaleLowerCase('tr-TR') : '';
  }

  function filterCommands(query, commands = COMMANDS) {
    const needle = normalizeQuery(query);
    if (!needle) return [...commands];
    return commands.filter((command) => `${command.label} ${command.hint}`.toLocaleLowerCase('tr-TR').includes(needle));
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function executeCommand(documentRef, command) {
    if (!COMMANDS.includes(command)) return false;
    const target = documentRef?.querySelector?.(command.selector);
    if (!target) return false;
    if (command.action === 'focus') {
      if (target.disabled || typeof target.focus !== 'function') return false;
      target.focus();
      return true;
    }
    if (command.action === 'click') {
      if (target.disabled || typeof target.click !== 'function') return false;
      target.click();
      return true;
    }
    if (command.action === 'scroll-end') {
      const last = target.lastElementChild;
      if (last?.scrollIntoView) last.scrollIntoView({ block: 'end', behavior: 'smooth' });
      else if (typeof target.scrollTo === 'function') target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
      else return false;
      return true;
    }
    return false;
  }

  function createController({ documentRef = globalThis.document } = {}) {
    if (!documentRef?.createElement || !documentRef?.addEventListener || !documentRef?.body) throw new Error('INVALID_COMMAND_PALETTE_DOCUMENT');
    installStyles(documentRef);

    const backdrop = documentRef.createElement('div');
    backdrop.className = 'hafize-command-palette-backdrop';
    backdrop.hidden = true;
    const dialog = documentRef.createElement('section');
    dialog.className = 'hafize-command-palette';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Hafize komut paleti');
    const input = documentRef.createElement('input');
    input.type = 'search';
    input.placeholder = 'Komut ara…';
    input.setAttribute('aria-label', 'Komut ara');
    const list = documentRef.createElement('div');
    list.className = 'hafize-command-list';
    list.setAttribute('role', 'listbox');
    dialog.append(input, list);
    backdrop.append(dialog);
    documentRef.body.append(backdrop);

    let visible = false;
    let filtered = [...COMMANDS];
    let activeIndex = 0;
    let restoreFocus = null;

    function render() {
      list.replaceChildren();
      if (!filtered.length) {
        const empty = documentRef.createElement('div');
        empty.className = 'hafize-command-empty';
        empty.textContent = 'Eşleşen komut yok.';
        list.append(empty);
        return;
      }
      filtered.forEach((command, index) => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'hafize-command-item';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(index === activeIndex));
        button.dataset.commandId = command.id;
        const label = documentRef.createElement('strong');
        label.textContent = command.label;
        const hint = documentRef.createElement('small');
        hint.textContent = command.hint;
        button.append(label, hint);
        button.addEventListener('click', () => run(command));
        list.append(button);
      });
      list.querySelector?.('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
    }

    function open() {
      if (visible) return true;
      visible = true;
      restoreFocus = documentRef.activeElement;
      input.value = '';
      filtered = [...COMMANDS];
      activeIndex = 0;
      backdrop.hidden = false;
      render();
      input.focus?.();
      return true;
    }

    function close({ restore = true } = {}) {
      if (!visible) return false;
      visible = false;
      backdrop.hidden = true;
      if (restore) restoreFocus?.focus?.();
      restoreFocus = null;
      return true;
    }

    function run(command) {
      const ok = executeCommand(documentRef, command);
      close({ restore: !ok });
      return ok;
    }

    function onInput() {
      filtered = filterCommands(input.value);
      activeIndex = 0;
      render();
    }

    function onKeydown(event) {
      if (isOpenShortcut(event)) {
        event.preventDefault?.();
        visible ? close() : open();
        return;
      }
      if (!visible) return;
      if (event.key === 'Escape') {
        event.preventDefault?.();
        close();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!filtered.length) return;
        event.preventDefault?.();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        activeIndex = (activeIndex + delta + filtered.length) % filtered.length;
        render();
        return;
      }
      if (event.key === 'Enter' && filtered[activeIndex]) {
        event.preventDefault?.();
        run(filtered[activeIndex]);
      }
    }

    input.addEventListener('input', onInput);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    documentRef.addEventListener('keydown', onKeydown);
    render();

    return Object.freeze({
      open,
      close,
      run,
      isOpen: () => visible,
      filter: (query) => filterCommands(query),
      destroy() {
        documentRef.removeEventListener?.('keydown', onKeydown);
        input.removeEventListener?.('input', onInput);
        backdrop.remove?.();
      }
    });
  }

  function mount(options) {
    try { return createController(options); } catch { return null; }
  }

  return Object.freeze({ COMMANDS, STYLE_ID, isOpenShortcut, normalizeQuery, filterCommands, executeCommand, createController, mount });
});
