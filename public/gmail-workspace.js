(function exposeHafizeGmailWorkspace(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeGmailWorkspace = api;
  const install = () => api.install(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeGmailWorkspace() {
  'use strict';

  const MAX_QUERY_CHARS = 120;
  const MAX_PROMPT_CHARS = 900;
  const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
  const PRESETS = Object.freeze({
    recent: 'Gmail hesabımdaki son 10 e-postayı yalnız salt-okunur Gmail araçlarıyla incele. Gönderen, konu, tarih ve kısa özet ver. Hiçbir e-postayı gönderme, silme, arşivleme, etiketleme veya değiştirme.',
    unread: 'Gmail hesabımdaki okunmamış son 10 e-postayı yalnız salt-okunur Gmail araçlarıyla incele. Önceliğe göre kısa bir özet çıkar. Hiçbir e-postayı gönderme, silme, arşivleme, etiketleme veya değiştirme.',
    important: 'Gmail hesabımdaki son e-postalar içinde dikkat gerektirenleri yalnız salt-okunur Gmail araçlarıyla incele. Neden önemli olabileceklerini kısa maddelerle açıkla. Hiçbir e-postayı gönderme, silme, arşivleme, etiketleme veya değiştirme.'
  });

  function normalizeSearchQuery(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > MAX_QUERY_CHARS || CONTROL_CHARS.test(clean)) return null;
    return clean;
  }

  function buildSearchPrompt(value) {
    const query = normalizeSearchQuery(value);
    if (!query) return null;
    const prompt = `Gmail hesabımda ${JSON.stringify(query)} ifadesiyle ilgili e-postaları yalnız salt-okunur Gmail araçlarıyla ara. En fazla 10 ilgili sonucu gönderen, konu, tarih ve kısa özetle göster. Hiçbir e-postayı gönderme, silme, arşivleme, etiketleme veya değiştirme.`;
    return prompt.length <= MAX_PROMPT_CHARS ? prompt : null;
  }

  function normalizePreset(name) {
    return typeof name === 'string' && Object.hasOwn(PRESETS, name) ? PRESETS[name] : null;
  }

  function isGmailLinked(statusNode) {
    if (!statusNode) return false;
    return statusNode.dataset?.state === 'linked';
  }

  function isToolModeEnabled(button) {
    return button?.getAttribute?.('aria-pressed') === 'true';
  }

  function isStreaming(sendButton) {
    return sendButton?.classList?.contains?.('streaming') === true;
  }

  function install(documentRef, root) {
    if (!documentRef?.body || !root) return null;
    const accountCard = documentRef.querySelector?.('#accountConnectionCard');
    const gmailStatus = documentRef.querySelector?.('#gmailConnectionStatus');
    const composer = documentRef.querySelector?.('#composer');
    const input = documentRef.querySelector?.('#messageInput');
    const toolButton = documentRef.querySelector?.('#toolModeBtn');
    const sendButton = documentRef.querySelector?.('#sendBtn');
    if (!accountCard || !gmailStatus || !composer || !input || !toolButton || !sendButton) return null;
    if (accountCard.querySelector?.('[data-hafize-gmail-workspace]')) return null;

    const section = documentRef.createElement('section');
    section.className = 'gmail-workspace';
    section.dataset.hafizeGmailWorkspace = '1';
    section.hidden = true;
    section.setAttribute('aria-labelledby', 'gmailWorkspaceTitle');

    const heading = documentRef.createElement('div');
    heading.className = 'gmail-workspace-head';
    const title = documentRef.createElement('strong');
    title.id = 'gmailWorkspaceTitle';
    title.textContent = 'Gmail ile çalış';
    const toolState = documentRef.createElement('span');
    toolState.className = 'gmail-workspace-tool-state';
    heading.append(title, toolState);

    const intro = documentRef.createElement('p');
    intro.className = 'gmail-workspace-intro';
    intro.textContent = 'Kısayollar yalnız composer taslağı hazırlar. Mesaj kendiliğinden gönderilmez.';

    const presetGrid = documentRef.createElement('div');
    presetGrid.className = 'gmail-workspace-presets';
    const presetSpecs = [
      ['recent', 'Son e-postalar'],
      ['unread', 'Okunmamışlar'],
      ['important', 'Dikkat gerekenler']
    ];
    for (const [name, label] of presetSpecs) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'gmail-workspace-preset';
      button.dataset.gmailPreset = name;
      button.textContent = label;
      presetGrid.append(button);
    }

    const searchForm = documentRef.createElement('form');
    searchForm.className = 'gmail-workspace-search';
    searchForm.autocomplete = 'off';
    const searchInput = documentRef.createElement('input');
    searchInput.type = 'search';
    searchInput.maxLength = MAX_QUERY_CHARS;
    searchInput.autocomplete = 'off';
    searchInput.placeholder = 'Gönderen, konu veya anahtar kelime';
    searchInput.setAttribute('aria-label', 'Gmail arama konusu');
    const searchButton = documentRef.createElement('button');
    searchButton.type = 'submit';
    searchButton.textContent = 'Taslağa aktar';
    searchForm.append(searchInput, searchButton);

    const toolAction = documentRef.createElement('button');
    toolAction.type = 'button';
    toolAction.className = 'gmail-workspace-tool-action';
    toolAction.textContent = 'Araç modunu aç';

    const status = documentRef.createElement('p');
    status.className = 'gmail-workspace-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    section.append(heading, intro, presetGrid, searchForm, toolAction, status);
    gmailStatus.insertAdjacentElement?.('afterend', section);
    if (!section.parentNode) accountCard.append(section);

    let destroyed = false;

    function setStatus(text, state = 'idle') {
      status.textContent = text;
      status.dataset.state = state;
    }

    function render() {
      if (destroyed) return;
      const linked = isGmailLinked(gmailStatus);
      const streaming = isStreaming(sendButton);
      const toolsEnabled = isToolModeEnabled(toolButton);
      section.hidden = !linked;
      section.setAttribute('aria-hidden', String(!linked));
      toolState.textContent = toolsEnabled ? 'Araçlar açık' : 'Araçlar kapalı';
      toolState.dataset.state = toolsEnabled ? 'ready' : 'off';
      toolAction.hidden = toolsEnabled;
      toolAction.disabled = !linked || streaming || toolButton.disabled;
      searchInput.disabled = !linked || streaming;
      searchButton.disabled = !linked || streaming;
      for (const button of presetGrid.querySelectorAll?.('[data-gmail-preset]') || []) {
        button.disabled = !linked || streaming;
      }
      if (!linked) setStatus('Gmail bağlandığında kısayollar burada görünür.');
      else if (streaming) setStatus('Aktif yanıt tamamlanınca yeni Gmail taslağı hazırlanabilir.');
      else if (!toolsEnabled) setStatus('Gmail okumak için gönderimden önce Araçlar modunu aç.');
      else if (!status.textContent || status.dataset.state === 'idle') setStatus('Salt-okunur Gmail kısayolları hazır.', 'ready');
    }

    function placePrompt(prompt) {
      if (destroyed || !isGmailLinked(gmailStatus) || isStreaming(sendButton)) return false;
      if (typeof prompt !== 'string' || !prompt || prompt.length > MAX_PROMPT_CHARS) return false;
      if (String(input.value || '').trim()) {
        setStatus('Composer’da mevcut taslak var; üzerine yazmadım.', 'warning');
        input.focus?.();
        return false;
      }
      input.value = prompt;
      input.dispatchEvent?.(new root.Event('input', { bubbles: true }));
      input.focus?.();
      setStatus('Gmail isteği composer’a aktarıldı. Kontrol edip kendin gönder.', 'ready');
      return true;
    }

    function onPresetClick(event) {
      const button = event.target?.closest?.('[data-gmail-preset]');
      if (!button || !presetGrid.contains?.(button)) return;
      const prompt = normalizePreset(button.dataset.gmailPreset);
      if (prompt) placePrompt(prompt);
    }

    function onSearch(event) {
      event.preventDefault?.();
      const prompt = buildSearchPrompt(searchInput.value);
      if (!prompt) {
        setStatus(`Arama 1–${MAX_QUERY_CHARS} güvenli karakter olmalı.`, 'warning');
        searchInput.focus?.();
        return;
      }
      if (placePrompt(prompt)) searchInput.value = '';
    }

    function onToolAction() {
      if (destroyed || toolAction.disabled || isToolModeEnabled(toolButton)) return;
      toolButton.click?.();
      render();
      if (isToolModeEnabled(toolButton)) setStatus('Araç modu açıldı. Taslağı kontrol edip gönderebilirsin.', 'ready');
    }

    presetGrid.addEventListener('click', onPresetClick);
    searchForm.addEventListener('submit', onSearch);
    toolAction.addEventListener('click', onToolAction);

    const observer = typeof root.MutationObserver === 'function'
      ? new root.MutationObserver(() => render())
      : null;
    observer?.observe(gmailStatus, { attributes: true, attributeFilter: ['data-state'], childList: true, characterData: true, subtree: true });
    observer?.observe(toolButton, { attributes: true, attributeFilter: ['aria-pressed', 'disabled'] });
    observer?.observe(sendButton, { attributes: true, attributeFilter: ['class'] });

    render();

    return Object.freeze({
      placePrompt,
      render,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        observer?.disconnect?.();
        presetGrid.removeEventListener?.('click', onPresetClick);
        searchForm.removeEventListener?.('submit', onSearch);
        toolAction.removeEventListener?.('click', onToolAction);
        section.remove?.();
      }
    });
  }

  return Object.freeze({
    MAX_QUERY_CHARS,
    MAX_PROMPT_CHARS,
    PRESETS,
    normalizeSearchQuery,
    buildSearchPrompt,
    normalizePreset,
    isGmailLinked,
    isToolModeEnabled,
    isStreaming,
    install
  });
});
