(function installHafizeComposerSlashRecent(root) {
  'use strict';

  const MENU_ID = 'composerSlashMenu';
  const RECENT_ID = 'composerSlashRecent';
  const MAX_ITEMS = 5;

  function render(documentRef, rootRef) {
    const menu = documentRef?.getElementById?.(MENU_ID);
    const api = rootRef.HafizeComposerSlashCommands;
    const input = documentRef?.getElementById?.('messageInput');
    if (!menu || !api || !input) return;

    let recent = documentRef.getElementById(RECENT_ID);
    if (!recent) {
      recent = documentRef.createElement('div');
      recent.id = RECENT_ID;
      recent.className = 'composer-slash-recent';
      recent.setAttribute('aria-label', 'Son kullanılan slash komutları');
      menu.insertBefore(recent, menu.querySelector('.composer-slash-list'));
    }

    recent.replaceChildren();
    const commands = api.listCommands()
      .map((command) => ({ command, count: api.usageOf(command, rootRef) }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ITEMS);

    if (!commands.length) {
      recent.hidden = true;
      return;
    }

    recent.hidden = false;
    for (const entry of commands) {
      const quick = documentRef.createElement('button');
      quick.type = 'button';
      quick.className = 'composer-slash-recent-item';
      quick.textContent = `/${entry.command.key} · ${entry.count}`;
      quick.setAttribute('aria-label', `/${entry.command.key} komutunu hazırla`);
      quick.addEventListener('click', () => {
        input.value = `/${entry.command.key} `;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
      });
      recent.append(quick);
    }
  }

  function install() {
    const documentRef = root.document;
    if (!documentRef || documentRef.getElementById('composerSlashRecentMarker')) return null;
    const marker = documentRef.createElement('span');
    marker.id = 'composerSlashRecentMarker';
    marker.hidden = true;
    documentRef.body.append(marker);
    const onOpen = () => render(documentRef, root);
    root.addEventListener?.('hafize:composer-slash-menu-opened', onOpen);
    return Object.freeze({
      render: () => render(documentRef, root),
      destroy: () => {
        root.removeEventListener?.('hafize:composer-slash-menu-opened', onOpen);
        documentRef.getElementById(RECENT_ID)?.remove();
        marker.remove();
      }
    });
  }

  root.HafizeComposerSlashRecent = Object.freeze({ install, render });
  const start = () => install();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
