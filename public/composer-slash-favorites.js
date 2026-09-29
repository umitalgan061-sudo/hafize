(function installHafizeComposerSlashFavorites(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.composer.slash.favorites.v1';
  const MENU_ID = 'composerSlashMenu';
  const INPUT_ID = 'messageInput';
  const MAX = 20;
  const CARD_ID = 'composerSlashFavorites';

  function cleanKey(value) {
    return typeof value === 'string'
      ? value.trim().toLocaleLowerCase('tr-TR').slice(0, 32)
      : '';
  }

  function read() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value)
        ? [...new Set(value.map(cleanKey).filter(Boolean))].slice(0, MAX)
        : [];
    } catch {
      return [];
    }
  }

  function write(keys) {
    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...new Set(keys.map(cleanKey).filter(Boolean))].slice(0, MAX)));
      return true;
    } catch {
      return false;
    }
  }

  function isFavorite(key) {
    const normalized = cleanKey(key);
    return Boolean(normalized && read().includes(normalized));
  }

  function setFavorite(key, value = true) {
    const normalized = cleanKey(key);
    if (!normalized) return false;
    const current = read();
    const next = value
      ? [normalized, ...current.filter((item) => item !== normalized)].slice(0, MAX)
      : current.filter((item) => item !== normalized);
    return write(next);
  }

  function toggleFavorite(key) {
    return setFavorite(key, !isFavorite(key));
  }

  function favoriteCommands(api = root.HafizeComposerSlashCommands) {
    if (!api) return [];
    const keys = new Set(read());
    return api.listCommands().filter((command) => keys.has(cleanKey(command.key)));
  }

  function text(documentRef, value, className = '') {
    const node = documentRef.createElement('span');
    if (className) node.className = className;
    node.textContent = String(value ?? '');
    return node;
  }

  function button(documentRef, label, className = 'mini-btn') {
    const node = documentRef.createElement('button');
    node.type = 'button';
    node.className = className;
    node.textContent = label;
    return node;
  }

  function refresh(documentRef, rootRef) {
    const menu = documentRef?.getElementById?.(MENU_ID);
    const api = rootRef.HafizeComposerSlashCommands;
    const input = documentRef?.getElementById?.(INPUT_ID);
    if (!menu || !api || !input) return;

    let block = documentRef.getElementById(CARD_ID);
    if (!block) {
      block = documentRef.createElement('div');
      block.id = CARD_ID;
      block.className = 'composer-slash-favorites';
      block.setAttribute('aria-label', 'Favori slash komutları');
      const title = text(documentRef, 'Favoriler', 'composer-slash-favorites-title');
      block.append(title);
      menu.insertBefore(block, menu.querySelector('.composer-slash-recent') || menu.querySelector('.composer-slash-list'));
    }

    block.querySelectorAll('.composer-slash-favorite-item').forEach((node) => node.remove());
    const commands = favoriteCommands(api).slice(0, MAX);
    if (!commands.length) {
      block.hidden = true;
      return;
    }

    block.hidden = false;
    for (const command of commands) {
      const quick = button(documentRef, `/${command.key}`);
      quick.className = 'composer-slash-favorite-item';
      quick.setAttribute('aria-label', `Favori /${command.key} komutunu hazırla`);
      quick.addEventListener('click', () => {
        input.value = `/${command.key} `;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
      });
      const remove = button(documentRef, '×');
      remove.className = 'composer-slash-favorite-remove';
      remove.setAttribute('aria-label', `/${command.key} favorisini kaldır`);
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        setFavorite(command.key, false);
        refresh(documentRef, rootRef);
      });
      quick.append(remove);
      block.append(quick);
    }
  }

  function install() {
    const documentRef = root.document;
    if (!documentRef || documentRef.getElementById('composerSlashFavoritesMarker')) return null;
    const marker = documentRef.createElement('span');
    marker.id = 'composerSlashFavoritesMarker';
    marker.hidden = true;
    documentRef.body.append(marker);

    const onOpen = () => refresh(documentRef, root);
    root.addEventListener?.('hafize:composer-slash-menu-opened', onOpen);

    const onCommand = (event) => {
      const command = event?.detail?.command;
      if (!command) return;
      refresh(documentRef, root);
    };
    root.addEventListener?.('hafize:composer-slash-command', onCommand);

    return Object.freeze({
      refresh: () => refresh(documentRef, root),
      read,
      isFavorite,
      setFavorite,
      toggleFavorite,
      favoriteCommands,
      destroy: () => {
        root.removeEventListener?.('hafize:composer-slash-menu-opened', onOpen);
        root.removeEventListener?.('hafize:composer-slash-command', onCommand);
        documentRef.getElementById(CARD_ID)?.remove();
        marker.remove();
      }
    });
  }

  root.HafizeComposerSlashFavorites = Object.freeze({
    STORAGE_KEY,
    MAX,
    read,
    isFavorite,
    setFavorite,
    toggleFavorite,
    favoriteCommands,
    refresh: () => refresh(root.document, root),
    install
  });

  const start = () => install();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
