(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const ui = {
    block: document.querySelector('.history-block'),
    history: document.querySelector('#conversationList'),
    toast: document.querySelector('#toast')
  };

  if (!ui.block || !ui.history) return;

  function announce(message) {
    if (!ui.toast || !message) return;
    ui.toast.textContent = message;
    ui.toast.classList.remove('hidden');
    window.clearTimeout(announce.timeoutId);
    announce.timeoutId = window.setTimeout(() => ui.toast.classList.add('hidden'), 3200);
  }

  function readConversations() {
    try {
      const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function safeText(value) {
    return typeof value === 'string' ? value : '';
  }

  function buildMarkdown(conversations) {
    const lines = ['# Hafize sohbet geçmişi', '', `Dışa aktarma tarihi: ${new Date().toLocaleString('tr-TR')}`, ''];
    for (const [index, conversation] of conversations.entries()) {
      lines.push(`## ${index + 1}. ${safeText(conversation?.title) || 'Yeni sohbet'}`);
      lines.push('');
      const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
      for (const message of messages) {
        const role = message?.role === 'assistant' ? 'Hafize' : 'Sen';
        const content = safeText(message?.content).trim();
        if (!content) continue;
        lines.push(`### ${role}`);
        lines.push('');
        lines.push(content);
        lines.push('');
      }
      lines.push('---', '');
    }
    return lines.join('\n');
  }

  function buildJson(conversations) {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: 1,
      conversations
    }, null, 2);
  }

  function download(content, filename, type) {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = 'noopener';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      return false;
    }
  }

  function addExportUi() {
    const old = ui.block.querySelector('.history-export');
    old?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'history-export';

    const label = document.createElement('span');
    label.className = 'history-export-label';
    label.textContent = 'Dışa aktar';

    const actions = document.createElement('div');
    actions.className = 'history-export-actions';

    for (const format of ['md', 'json']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-export-btn';
      button.textContent = format === 'md' ? 'Markdown' : 'JSON';
      button.setAttribute('aria-label', `Sohbet geçmişini ${format === 'md' ? 'Markdown' : 'JSON'} olarak dışa aktar`);
      button.addEventListener('click', () => {
        const conversations = readConversations();
        if (!conversations.length) return announce('Dışa aktarılacak sohbet geçmişi yok.');
        const content = format === 'md' ? buildMarkdown(conversations) : buildJson(conversations);
        const filename = `hafize-sohbet-gecmisi-${new Date().toISOString().slice(0, 10)}.${format}`;
        const type = format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8';
        announce(download(content, filename, type)
          ? `${format === 'md' ? 'Markdown' : 'JSON'} dosyası hazırlandı.`
          : 'Dışa aktarma başlatılamadı.');
      });
      actions.append(button);
    }

    wrap.append(label, actions);
    ui.block.insertBefore(wrap, ui.history);
  }

  addExportUi();
  new MutationObserver(() => {
    if (!ui.block.querySelector('.history-export')) addExportUi();
  }).observe(ui.block, { childList: true });

  Object.freeze({ buildMarkdown, buildJson, download });
})();
