(function installHafizeComposerSlashCommands(root) {
  'use strict';

  const INPUT_ID = 'messageInput';
  const COMPOSER_ID = 'composer';
  const MENU_ID = 'composerSlashMenu';
  const MAX_QUERY = 48;
  const MAX_INPUT = 12000;
  const MAX_CUSTOM = 30;
  const MAX_KEY = 32;
  const MAX_LABEL = 64;
  const MAX_DESCRIPTION = 160;
  const MAX_TEMPLATE = 6000;
  const USAGE_KEY = 'hafize.composer.slash.usage.v1';

  const COMMANDS = Object.freeze([
    Object.freeze({ key: 'özet', aliases: ['ozet', 'summary'], label: 'Kısa özet', description: 'Metni kısa ve anlaşılır biçimde özetle.', template: (rest) => rest ? `Şu konuyu kısa ve anlaşılır biçimde özetle: ${rest}` : 'Bir sonraki metni kısa ve anlaşılır biçimde özetle.' }),
    Object.freeze({ key: 'yaz', aliases: ['write'], label: 'Metin yaz', description: 'Taslak ve içerik oluştur.', template: (rest) => rest ? `Şu konu için iyi yapılandırılmış bir metin taslağı yaz: ${rest}` : 'Bir sonraki isteğim için iyi yapılandırılmış bir metin taslağı yaz.' }),
    Object.freeze({ key: 'düzenle', aliases: ['duzenle', 'rewrite'], label: 'Metni düzenle', description: 'Metni daha açık ve profesyonel hale getir.', template: (rest) => rest ? `Şu metni anlamını koruyarak daha açık ve profesyonel biçimde düzenle: ${rest}` : 'Bir sonraki metni anlamını koruyarak daha açık ve profesyonel biçimde düzenle.' }),
    Object.freeze({ key: 'araştır', aliases: ['arastir', 'research'], label: 'Araştır', description: 'Araştırma sorusunu çerçevele ve kaynak ihtiyacını belirle.', template: (rest) => rest ? `Şu konu için araştırma planı oluştur ve hangi kaynakların gerekli olduğunu belirt: ${rest}` : 'Bir sonraki konu için araştırma planı oluştur ve gerekli kaynak türlerini belirt.' }),
    Object.freeze({ key: 'kod', aliases: ['code'], label: 'Kod incele', description: 'Kodu analiz et, hata ve iyileştirme noktalarını çıkar.', template: (rest) => rest ? `Şu kodu incele; hataları, riskleri ve iyileştirme önerilerini sırala: ${rest}` : 'Bir sonraki kod parçasını incele; hataları, riskleri ve iyileştirme önerilerini çıkar.' }),
    Object.freeze({ key: 'plan', aliases: ['planner'], label: 'Planla', description: 'İşi adımlara böl ve uygulanabilir bir plan çıkar.', template: (rest) => rest ? `Şu iş için öncelikli, uygulanabilir bir adım planı hazırla: ${rest}` : 'Bir sonraki işi öncelikli ve uygulanabilir adımlara böl.' }),
    Object.freeze({ key: 'toplantı', aliases: ['toplanti', 'meeting'], label: 'Toplantı notu', description: 'Toplantı notlarını düzenli karar ve aksiyonlara çevir.', template: (rest) => rest ? `Şu toplantı içeriğini kararlar, aksiyonlar ve sorumlular halinde düzenle: ${rest}` : 'Bir sonraki toplantı notunu kararlar, aksiyonlar ve sorumlular halinde düzenle.' }),
    Object.freeze({ key: 'mail', aliases: ['email'], label: 'E-posta', description: 'Profesyonel ve uygun tonda e-posta taslağı oluştur.', template: (rest) => rest ? `Şu konu için profesyonel bir e-posta taslağı hazırla: ${rest}` : 'Bir sonraki konu için profesyonel bir e-posta taslağı hazırla.' }),
    Object.freeze({ key: 'test', aliases: ['tests'], label: 'Test senaryosu', description: 'Kod için test senaryoları ve uç durumlar öner.', template: (rest) => rest ? `Şu özellik için birim, entegrasyon ve uç durum test senaryoları çıkar: ${rest}` : 'Bir sonraki özellik için birim, entegrasyon ve uç durum test senaryoları çıkar.' }),
    Object.freeze({ key: 'karar', aliases: ['decision'], label: 'Karar matrisi', description: 'Seçenekleri ölçütlere ayır ve tarafsız bir karar matrisi kur.', template: (rest) => rest ? `Şu konu için seçenekleri ölçütlere ayıran tarafsız bir karar matrisi oluştur: ${rest}` : 'Bir sonraki konu için seçenekleri ve ölçütleri ayıran tarafsız bir karar matrisi oluştur.' }),
    Object.freeze({ key: 'öğret', aliases: ['ogret', 'teach'], label: 'Öğret', description: 'Konuyu sade, aşamalı ve örnekli biçimde anlat.', template: (rest) => rest ? `Şu konuyu temel düzeyden başlayarak aşamalı ve örnekli biçimde öğret: ${rest}` : 'Bir sonraki konuyu temel düzeyden başlayarak aşamalı ve örnekli biçimde öğret.' }),
    Object.freeze({ key: 'fikir', aliases: ['fikirler', 'ideas'], label: 'Fikir üret', description: 'Alternatif fikirler üret ve kısa gerekçeler ekle.', template: (rest) => rest ? `Şu konu için birbirinden farklı fikirler üret ve her birine kısa gerekçe ekle: ${rest}` : 'Bir sonraki konu için birbirinden farklı fikirler üret ve kısa gerekçeler ekle.' })
  ]);

  function editableTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
  }

  function parseQuery(value) {
    const text = String(value ?? '');
    const match = text.match(/^\s*\/([^\s\n]{0,48})(?:\s+(.*))?$/s);
    if (!match) return null;
    return { token: match[1].toLocaleLowerCase('tr-TR'), rest: String(match[2] ?? '').trimStart() };
  }

  let runtimeCommands = COMMANDS.slice();

  function clean(value, limit) {
    return typeof value === 'string' ? value.trim().replace(/[\\u0000\\r\\n]/g, ' ').slice(0, limit) : '';
  }

  function readUsage(rootRef = root) {
    try {
      const value = JSON.parse(rootRef.localStorage?.getItem(USAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }

  function writeUsage(usage, rootRef = root) {
    try { rootRef.localStorage?.setItem(USAGE_KEY, JSON.stringify(usage)); return true; } catch { return false; }
  }

  function recordUsage(key, rootRef = root) {
    const normalized = clean(key, MAX_KEY).toLocaleLowerCase('tr-TR');
    if (!normalized) return;
    const usage = readUsage(rootRef);
    usage[normalized] = Number.isFinite(usage[normalized]) ? Math.min(9999, Math.floor(usage[normalized]) + 1) : 1;
    const entries = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 60);
    writeUsage(Object.fromEntries(entries), rootRef);
  }

  function usageOf(command, rootRef = root) {
    return Number(readUsage(rootRef)[command.key] || 0);
  }

  function aliasesOf(command) { return Array.isArray(command.aliases) ? command.aliases : []; }

  function matchCommands(token) {
    const query = String(token ?? '').toLocaleLowerCase('tr-TR').slice(0, MAX_QUERY);
    if (!query) return runtimeCommands.slice().sort((a, b) => usageOf(b) - usageOf(a)).slice(0, 8);
    return runtimeCommands.filter((command) => command.key.startsWith(query) || aliasesOf(command).some((alias) => alias.startsWith(query)) || command.label.toLocaleLowerCase('tr-TR').includes(query)).slice(0, 8);
  }

  function commandByKey(key) {
    const normalized = String(key ?? '').toLocaleLowerCase('tr-TR');
    return runtimeCommands.find((command) => command.key === normalized || aliasesOf(command).includes(normalized)) || null;
  }

  function normalizeCustomCommand(input) {
    if (!input || typeof input !== 'object') return null;
    const key = clean(input.key, MAX_KEY).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9_-]/g, '');
    const label = clean(input.label, MAX_LABEL);
    const description = clean(input.description, MAX_DESCRIPTION);
    const template = typeof input.templateText === 'string' ? input.templateText.replace(/\\0/g, '').slice(0, MAX_TEMPLATE) : '';
    if (!key || !label || !template) return null;
    return Object.freeze({ id: clean(input.id, 120) || `custom-${key}`, key, aliases: [], label, description: description || 'Özel slash komutu', templateText: template, custom: true });
  }

  function registerCommand(input) {
    const command = normalizeCustomCommand(input);
    if (!command || runtimeCommands.some((entry) => entry.key === command.key && !entry.custom)) return null;
    runtimeCommands = [...runtimeCommands.filter((entry) => entry.key !== command.key), Object.freeze({ ...command, template: (rest) => {
      const safeRest = String(rest ?? '').slice(0, MAX_INPUT);
      const rendered = command.templateText.replace(/\\{\\{\\s*konu\\s*\\}\\}/gi, safeRest);
      return normalizeInput(rendered.includes(safeRest) || !safeRest ? rendered : `${rendered} ${safeRest}`);
    } })];
    return command;
  }

  function unregisterCommand(key) {
    const normalized = clean(key, MAX_KEY).toLocaleLowerCase('tr-TR');
    if (COMMANDS.some((command) => command.key === normalized)) return false;
    const before = runtimeCommands.length;
    runtimeCommands = runtimeCommands.filter((command) => command.key !== normalized);
    return runtimeCommands.length !== before;
  }

  function normalizeInput(value) {
    return String(value ?? '').slice(0, MAX_INPUT);
  }

  function applyCommand(command, rest) {
    if (!command) return '';
    return normalizeInput(command.template(String(rest ?? '').trim()));
  }

  function mount(documentRef = root.document, rootRef = root) {
    const input = documentRef?.getElementById?.(INPUT_ID);
    const composer = documentRef?.getElementById?.(COMPOSER_ID);
    if (!documentRef || !input || !composer || documentRef.getElementById(MENU_ID)) return null;

    const menu = documentRef.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'composer-slash-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'Slash komutları');
    menu.hidden = true;

    const title = documentRef.createElement('div');
    title.className = 'composer-slash-title';
    title.textContent = 'Hızlı komutlar';
    menu.append(title);

    const list = documentRef.createElement('div');
    list.className = 'composer-slash-list';
    menu.append(list);

    const status = documentRef.createElement('div');
    status.className = 'composer-slash-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    menu.append(status);

    composer.append(menu);

    let matches = [];
    let activeIndex = 0;
    let visible = false;
    let baseToken = '';
    let baseRest = '';
    const listeners = [];

    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };

    function setMenuState(open) {
      visible = open;
      menu.hidden = !open;
      input.setAttribute('aria-expanded', String(open));
      input.setAttribute('aria-controls', MENU_ID);
      if (!open) input.removeAttribute('aria-activedescendant');
    }

    function render() {
      list.replaceChildren();
      matches.forEach((command, index) => {
        const option = documentRef.createElement('button');
        option.type = 'button';
        option.className = 'composer-slash-option';
        option.dataset.command = command.key;
        option.id = `composerSlashOption-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(index === activeIndex));
        const key = documentRef.createElement('strong');
        key.textContent = `/${command.key}`;
        const label = documentRef.createElement('span');
        label.className = 'composer-slash-label';
        label.textContent = command.label;
        const description = documentRef.createElement('small');
        description.textContent = command.description;
        const usage = documentRef.createElement('small');
        usage.className = 'composer-slash-usage';
        usage.textContent = usageOf(command, rootRef) ? `${usageOf(command, rootRef)} kullanım` : '';
        option.append(key, label, description, usage);
        option.addEventListener('click', () => choose(index));
        list.append(option);
      });
      if (matches[activeIndex]) input.setAttribute('aria-activedescendant', `composerSlashOption-${activeIndex}`);
      else input.removeAttribute('aria-activedescendant');
      status.textContent = matches.length ? `${matches.length} komut` : 'Komut bulunamadı';
    }

    function hide() {
      matches = [];
      activeIndex = 0;
      baseToken = '';
      baseRest = '';
      setMenuState(false);
      list.replaceChildren();
      status.textContent = '';
    }

    function openFor(query) {
      matches = matchCommands(query.token);
      activeIndex = 0;
      baseToken = query.token;
      baseRest = query.rest;
      render();
      setMenuState(true);
      rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:composer-slash-menu-opened'));
    }

    function choose(index) {
      const command = matches[index];
      if (!command) return;
      input.value = applyCommand(command, baseRest);
      recordUsage(command.key, rootRef);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:composer-slash-command', { detail: { command: command.key, custom: command.custom === true } }));
      hide();
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    }

    function updateFromInput() {
      const query = parseQuery(input.value);
      if (!query) {
        if (visible) hide();
        return;
      }
      if (!visible || query.token !== baseToken || query.rest !== baseRest) openFor(query);
    }

    function onKeydown(event) {
      if (!visible) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!matches.length) return;
        activeIndex = (activeIndex + 1) % matches.length;
        render();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!matches.length) return;
        activeIndex = (activeIndex - 1 + matches.length) % matches.length;
        render();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        if (!matches.length) return;
        event.preventDefault();
        choose(activeIndex);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        hide();
      }
    }

    on(input, 'input', updateFromInput);
    on(input, 'keydown', onKeydown);
    on(documentRef, 'click', (event) => {
      if (!menu.contains(event.target) && event.target !== input) hide();
    });
    on(documentRef, 'keydown', (event) => {
      if (event.key === 'Escape' && visible && !editableTarget(event.target)) hide();
    });

    render();
    return Object.freeze({
      mounted: true,
      commands: COMMANDS.slice(),
      getVisibleCommands: () => matches.slice(),
      isVisible: () => visible,
      choose,
      hide,
      destroy: () => {
        hide();
        for (const off of listeners.splice(0)) off();
        menu.remove();
        input.removeAttribute('aria-controls');
        input.removeAttribute('aria-expanded');
        input.removeAttribute('aria-activedescendant');
      }
    });
  }

  root.HafizeComposerSlashCommands = Object.freeze({
    COMMANDS,
    USAGE_KEY,
    MAX_CUSTOM,
    MAX_KEY,
    MAX_LABEL,
    MAX_DESCRIPTION,
    MAX_TEMPLATE,
    parseQuery,
    matchCommands,
    commandByKey,
    applyCommand,
    normalizeInput,
    readUsage,
    recordUsage,
    usageOf,
    normalizeCustomCommand,
    registerCommand,
    unregisterCommand,
    listCommands: () => runtimeCommands.slice(),
    mount
  });

  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
