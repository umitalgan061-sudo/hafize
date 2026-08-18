(function exposeHafizeConversationInsights(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeConversationInsights = api;
    const install = () => {
      api.installConversationForkAsset(root.document);
      api.mount({ documentRef: root.document, MutationObserverImpl: root.MutationObserver });
    };
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationInsights() {
  'use strict';

  const WORDS_PER_MINUTE = 220;
  const CARD_ID = 'conversationInsightsCard';
  const STATUS_ID = 'conversationInsightsStatus';
  const FORK_SCRIPT_ID = 'hafizeConversationForkScript';
  const FORK_SCRIPT_SRC = '/conversation-fork.js';

  function installConversationForkAsset(documentRef) {
    if (!documentRef?.head || typeof documentRef.createElement !== 'function') return false;
    if (documentRef.getElementById?.(FORK_SCRIPT_ID)) return false;
    const script = documentRef.createElement('script');
    script.id = FORK_SCRIPT_ID;
    script.src = FORK_SCRIPT_SRC;
    script.async = false;
    documentRef.head.append(script);
    return true;
  }

  function normalizeVisibleText(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function countWords(value) {
    const text = normalizeVisibleText(value);
    return text ? text.split(' ').filter(Boolean).length : 0;
  }

  function estimateReadingMinutes(words, wordsPerMinute = WORDS_PER_MINUTE) {
    const count = Number.isFinite(words) && words > 0 ? words : 0;
    const pace = Number.isFinite(wordsPerMinute) && wordsPerMinute >= 100 ? wordsPerMinute : WORDS_PER_MINUTE;
    return count ? Math.max(1, Math.ceil(count / pace)) : 0;
  }

  function collectConversationStats(messages) {
    const articles = messages?.querySelectorAll?.('.message') || [];
    let userMessages = 0;
    let assistantMessages = 0;
    let words = 0;
    let characters = 0;

    for (const article of articles) {
      const isUser = article?.classList?.contains?.('user') === true;
      const isAssistant = article?.classList?.contains?.('assistant') === true;
      if (!isUser && !isAssistant) continue;
      const text = normalizeVisibleText(article.querySelector?.('.content')?.textContent || '');
      if (isUser) userMessages += 1;
      if (isAssistant) assistantMessages += 1;
      words += countWords(text);
      characters += text.length;
    }

    const totalMessages = userMessages + assistantMessages;
    return Object.freeze({
      totalMessages,
      userMessages,
      assistantMessages,
      words,
      characters,
      readingMinutes: estimateReadingMinutes(words)
    });
  }

  function formatStats(stats) {
    if (!stats?.totalMessages) return 'Aktif sohbette henüz mesaj yok.';
    const minuteText = stats.readingMinutes === 1 ? 'yaklaşık 1 dk okuma' : `yaklaşık ${stats.readingMinutes} dk okuma`;
    return `${stats.totalMessages} mesaj · ${stats.words} kelime · ${minuteText}`;
  }

  function createCard(documentRef) {
    const card = documentRef.createElement('section');
    card.id = CARD_ID;
    card.className = 'utility-card conversation-insights-card';
    card.hidden = true;
    card.setAttribute('aria-labelledby', `${CARD_ID}Title`);

    const head = documentRef.createElement('div');
    head.className = 'utility-head';
    const icon = documentRef.createElement('span');
    icon.className = 'mini-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '≡';
    const title = documentRef.createElement('span');
    title.id = `${CARD_ID}Title`;
    title.textContent = 'Sohbet bilgisi';
    head.append(icon, title);

    const status = documentRef.createElement('p');
    status.id = STATUS_ID;
    status.className = 'conversation-insights-summary';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    const details = documentRef.createElement('dl');
    details.className = 'conversation-insights-grid';
    for (const [key, label] of [['user', 'Sen'], ['assistant', 'Hafize'], ['characters', 'Karakter']]) {
      const item = documentRef.createElement('div');
      item.dataset.metric = key;
      const term = documentRef.createElement('dt');
      term.textContent = label;
      const value = documentRef.createElement('dd');
      value.textContent = '0';
      item.append(term, value);
      details.append(item);
    }

    const privacy = documentRef.createElement('small');
    privacy.className = 'conversation-insights-privacy';
    privacy.textContent = 'Yalnız bu ekrandaki aktif sohbetten hesaplanır.';

    card.append(head, status, details, privacy);
    return card;
  }

  function createController({ documentRef = globalThis.document, MutationObserverImpl = globalThis.MutationObserver } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_CONVERSATION_INSIGHTS_DOCUMENT');
    let messages = null;
    let rail = null;
    let card = null;
    let observer = null;
    let mounted = false;
    let generated = false;

    function metricValue(name) {
      return card?.querySelector?.(`[data-metric="${name}"] dd`) || null;
    }

    function render(stats = collectConversationStats(messages)) {
      if (!card) return stats;
      card.hidden = stats.totalMessages === 0;
      const status = card.querySelector?.(`#${STATUS_ID}`);
      if (status) status.textContent = formatStats(stats);
      const user = metricValue('user');
      const assistant = metricValue('assistant');
      const characters = metricValue('characters');
      if (user) user.textContent = String(stats.userMessages);
      if (assistant) assistant.textContent = String(stats.assistantMessages);
      if (characters) characters.textContent = String(stats.characters);
      return stats;
    }

    function mount() {
      if (mounted) return true;
      messages = documentRef.querySelector('#messages');
      rail = documentRef.querySelector('.utility-rail');
      if (!messages || !rail) return false;
      card = documentRef.querySelector(`#${CARD_ID}`);
      if (!card) {
        card = createCard(documentRef);
        rail.append(card);
        generated = true;
      }
      mounted = true;
      render();
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => render());
        observer.observe(messages, { childList: true, subtree: true, characterData: true });
      }
      return true;
    }

    function destroy() {
      observer?.disconnect?.();
      observer = null;
      if (generated) card?.remove?.();
      card = null;
      messages = null;
      rail = null;
      mounted = false;
      generated = false;
    }

    return Object.freeze({ mount, destroy, render, snapshot: () => collectConversationStats(messages) });
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
    WORDS_PER_MINUTE,
    CARD_ID,
    STATUS_ID,
    FORK_SCRIPT_ID,
    FORK_SCRIPT_SRC,
    installConversationForkAsset,
    normalizeVisibleText,
    countWords,
    estimateReadingMinutes,
    collectConversationStats,
    formatStats,
    createCard,
    createController,
    mount
  });
});
