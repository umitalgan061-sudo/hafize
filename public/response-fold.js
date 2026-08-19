(function exposeHafizeResponseFold(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeResponseFold = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeResponseFold() {
  'use strict';

  const MIN_COLLAPSE_CHARS = 1800;
  const MARKER = 'hafizeResponseFoldReady';
  const CONTENT_CLASS = 'hafize-response-collapsible';
  const COLLAPSED_CLASS = 'hafize-response-collapsed';
  const ACTIONS_CLASS = 'hafize-response-fold-actions';
  const BUTTON_CLASS = 'hafize-response-fold-toggle';
  const STYLE_ID = 'hafize-response-fold-style';
  const STYLE_TEXT = `
.${CONTENT_CLASS}{position:relative}
.${CONTENT_CLASS}.${COLLAPSED_CLASS}{max-height:min(46vh,420px);overflow:hidden}
.${CONTENT_CLASS}.${COLLAPSED_CLASS}::after{content:'';position:absolute;left:0;right:0;bottom:0;height:72px;pointer-events:none;background:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--surface,#fff) 96%,transparent))}
.${ACTIONS_CLASS}{display:flex;justify-content:flex-start;margin-top:8px}
.${BUTTON_CLASS}{border:1px solid var(--line,#ddd);border-radius:999px;background:transparent;color:inherit;padding:6px 10px;font:inherit;font-size:11px;font-weight:700;cursor:pointer}
.${BUTTON_CLASS}:hover,.${BUTTON_CLASS}:focus-visible{background:color-mix(in srgb,var(--surface,#fff) 84%,var(--line,#ddd))}
.${BUTTON_CLASS}:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
@media(max-width:720px){.${CONTENT_CLASS}.${COLLAPSED_CLASS}{max-height:min(52vh,360px)}.${BUTTON_CLASS}{min-height:34px}}
@media(prefers-reduced-motion:no-preference){.${BUTTON_CLASS}{transition:background-color .15s ease,border-color .15s ease}}
`;

  function normalizedText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  }

  function shouldFoldText(value, threshold = MIN_COLLAPSE_CHARS) {
    if (!Number.isInteger(threshold) || threshold < 1) return false;
    return normalizedText(value).length >= threshold;
  }

  function isAssistantArticle(article) {
    return Boolean(article?.classList?.contains?.('message') && article.classList.contains('assistant'));
  }

  function lastAssistant(messages) {
    const articles = messages?.querySelectorAll?.('.message.assistant') || [];
    return articles.length ? articles[articles.length - 1] : null;
  }

  function shouldDeferForStreaming(article, messages, sendButton) {
    if (!article || !messages || !sendButton?.classList?.contains?.('streaming')) return false;
    return lastAssistant(messages) === article;
  }

  function setExpanded(content, button, expanded) {
    if (!content?.classList || !button?.setAttribute) return false;
    const open = Boolean(expanded);
    content.classList.add(CONTENT_CLASS);
    content.classList.toggle(COLLAPSED_CLASS, !open);
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Daralt' : 'Devamını göster';
    button.title = open ? 'Uzun yanıtı yeniden daralt' : 'Uzun yanıtın tamamını göster';
    return true;
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({
    documentRef = globalThis.document,
    MutationObserverImpl = globalThis.MutationObserver,
    threshold = MIN_COLLAPSE_CHARS
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_RESPONSE_FOLD_DOCUMENT');
    if (!Number.isInteger(threshold) || threshold < 1) throw new Error('INVALID_RESPONSE_FOLD_THRESHOLD');

    let messages = null;
    let sendButton = null;
    let observer = null;
    let mounted = false;
    let destroyed = false;
    let nextId = 1;
    const decorations = new Map();

    function contentId(content) {
      if (typeof content.id === 'string' && content.id) return content.id;
      const id = `hafize-response-fold-${nextId}`;
      nextId += 1;
      content.id = id;
      return id;
    }

    function restoreDecoration(article, record) {
      record.button?.removeEventListener?.('click', record.onClick);
      record.actions?.remove?.();
      if (record.content?.classList) {
        record.content.classList.toggle(CONTENT_CLASS, record.hadContentClass);
        record.content.classList.toggle(COLLAPSED_CLASS, record.hadCollapsedClass);
      }
      if (record.content) record.content.id = record.hadContentId ? record.contentId : '';
      if (article?.dataset) {
        if (record.hadMarker) article.dataset[MARKER] = record.markerValue;
        else delete article.dataset[MARKER];
      }
    }

    function decorate(article) {
      if (destroyed || !isAssistantArticle(article)) return false;
      if (article.dataset?.[MARKER] === '1') return false;
      if (shouldDeferForStreaming(article, messages, sendButton)) return false;
      const content = article.querySelector?.('.content');
      if (!content || !shouldFoldText(content.textContent, threshold)) return false;
      if (article.querySelector?.(`.${ACTIONS_CLASS}`)) return false;

      const hadMarker = Boolean(article.dataset && Object.prototype.hasOwnProperty.call(article.dataset, MARKER));
      const markerValue = hadMarker ? article.dataset[MARKER] : undefined;
      const hadContentClass = Boolean(content.classList?.contains?.(CONTENT_CLASS));
      const hadCollapsedClass = Boolean(content.classList?.contains?.(COLLAPSED_CLASS));
      const hadContentId = typeof content.id === 'string' && Boolean(content.id);
      const originalContentId = hadContentId ? content.id : '';
      const actions = documentRef.createElement('div');
      actions.className = ACTIONS_CLASS;

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = BUTTON_CLASS;
      button.setAttribute('aria-controls', contentId(content));
      button.setAttribute('aria-label', 'Uzun Hafize yanıtını genişlet veya daralt');
      setExpanded(content, button, false);
      const onClick = () => {
        if (destroyed || !decorations.has(article)) return;
        const expanded = button.getAttribute('aria-expanded') === 'true';
        setExpanded(content, button, !expanded);
      };
      button.addEventListener('click', onClick);

      actions.append(button);
      article.append(actions);
      if (article.dataset) article.dataset[MARKER] = '1';
      decorations.set(article, Object.freeze({
        content,
        actions,
        button,
        onClick,
        hadMarker,
        markerValue,
        hadContentClass,
        hadCollapsedClass,
        hadContentId,
        contentId: originalContentId
      }));
      return true;
    }

    function decorateAll(root = messages || documentRef) {
      if (destroyed) return 0;
      const articles = root?.querySelectorAll?.('.message.assistant') || [];
      let count = 0;
      for (const article of articles) if (decorate(article)) count += 1;
      return count;
    }

    function reconsiderMarked() {
      for (const [article, record] of [...decorations]) {
        if (shouldFoldText(record.content?.textContent, threshold)) continue;
        restoreDecoration(article, record);
        decorations.delete(article);
      }
    }

    function refresh() {
      if (!mounted || destroyed) return 0;
      reconsiderMarked();
      return decorateAll(messages);
    }

    function mount() {
      if (destroyed) return false;
      if (mounted) return true;
      messages = documentRef.querySelector('#messages');
      sendButton = documentRef.querySelector('#sendBtn');
      if (!messages) return false;
      installStyles(documentRef);
      mounted = true;
      refresh();
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(refresh);
        observer.observe(messages, { childList: true, subtree: true, characterData: true });
        if (sendButton) observer.observe(sendButton, { attributes: true, attributeFilter: ['class'] });
      }
      return true;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      mounted = false;
      observer?.disconnect?.();
      observer = null;
      for (const [article, record] of decorations) restoreDecoration(article, record);
      decorations.clear();
      messages = null;
      sendButton = null;
    }

    function snapshot() {
      return Object.freeze({ mounted, threshold, decorated: decorations.size });
    }

    return Object.freeze({ mount, destroy, refresh, decorate, decorateAll, snapshot });
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
    MIN_COLLAPSE_CHARS,
    MARKER,
    CONTENT_CLASS,
    COLLAPSED_CLASS,
    ACTIONS_CLASS,
    BUTTON_CLASS,
    STYLE_ID,
    normalizedText,
    shouldFoldText,
    isAssistantArticle,
    lastAssistant,
    shouldDeferForStreaming,
    setExpanded,
    installStyles,
    createController,
    mount
  });
});