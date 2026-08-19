(function exposeHafizeScrollToLatest(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeScrollToLatest = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScrollToLatest() {
  'use strict';

  const BUTTON_ID = 'scrollToLatestBtn';
  const STYLE_ID = 'hafize-scroll-to-latest-style';
  const NEAR_BOTTOM_PX = 96;
  const STYLE_TEXT = `
.scroll-to-latest{position:fixed;z-index:40;right:clamp(16px,3vw,42px);bottom:112px;border:1px solid var(--line,#ddd);border-radius:999px;background:color-mix(in srgb,var(--surface,#fff) 94%,transparent);color:inherit;padding:8px 12px;box-shadow:0 8px 28px rgba(0,0,0,.12);font:inherit;font-size:12px;font-weight:700;cursor:pointer;backdrop-filter:blur(10px)}
.scroll-to-latest[hidden]{display:none}
.scroll-to-latest[data-state="new"]{border-color:color-mix(in srgb,var(--accent,#d97706) 55%,var(--line,#ddd))}
.scroll-to-latest:hover,.scroll-to-latest:focus-visible{background:var(--surface,#fff)}
.scroll-to-latest:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
@media (max-width:900px){.scroll-to-latest{right:16px;bottom:104px}}
`;

  function finiteNonNegative(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function distanceToBottom({ scrollY, innerHeight, scrollHeight } = {}) {
    const top = finiteNonNegative(scrollY);
    const viewport = finiteNonNegative(innerHeight);
    const height = finiteNonNegative(scrollHeight);
    return Math.max(0, height - (top + viewport));
  }

  function isNearBottom(metrics, threshold = NEAR_BOTTOM_PX) {
    if (!Number.isFinite(threshold) || threshold < 0) return false;
    return distanceToBottom(metrics) <= threshold;
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
    windowRef = globalThis.window,
    MutationObserverImpl = globalThis.MutationObserver,
    requestAnimationFrameImpl = globalThis.requestAnimationFrame,
    cancelAnimationFrameImpl = globalThis.cancelAnimationFrame,
    matchMediaImpl = globalThis.matchMedia
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_SCROLL_TO_LATEST_DOCUMENT');
    if (!windowRef || typeof windowRef.addEventListener !== 'function' || typeof windowRef.scrollTo !== 'function') {
      throw new Error('INVALID_SCROLL_TO_LATEST_WINDOW');
    }
    if (typeof requestAnimationFrameImpl !== 'function' || typeof cancelAnimationFrameImpl !== 'function') {
      throw new Error('INVALID_SCROLL_TO_LATEST_FRAME');
    }

    let button = null;
    let buttonOwned = false;
    let messages = null;
    let observer = null;
    let frame = null;
    let mounted = false;
    let generation = 0;
    let pinned = true;
    let unseen = false;

    function scrollHeight() {
      return Math.max(
        finiteNonNegative(documentRef.documentElement?.scrollHeight),
        finiteNonNegative(documentRef.body?.scrollHeight)
      );
    }

    function metrics() {
      return Object.freeze({
        scrollY: finiteNonNegative(windowRef.scrollY ?? windowRef.pageYOffset),
        innerHeight: finiteNonNegative(windowRef.innerHeight),
        scrollHeight: scrollHeight()
      });
    }

    function reduceMotion() {
      if (typeof matchMediaImpl !== 'function') return false;
      try { return matchMediaImpl('(prefers-reduced-motion: reduce)')?.matches === true; }
      catch { return false; }
    }

    function setButtonState() {
      if (!mounted || !button) return false;
      const near = isNearBottom(metrics());
      if (near) {
        pinned = true;
        unseen = false;
        button.hidden = true;
        button.dataset.state = 'idle';
        button.textContent = '↓ En alta git';
        return true;
      }
      button.hidden = false;
      button.dataset.state = unseen ? 'new' : 'idle';
      button.textContent = unseen ? '↓ Yeni yanıt' : '↓ En alta git';
      return true;
    }

    function scheduleMeasure() {
      if (!mounted || frame !== null) return false;
      const scheduledGeneration = generation;
      const frameId = requestAnimationFrameImpl(() => {
        if (frame === frameId) frame = null;
        if (!mounted || scheduledGeneration !== generation) return;
        setButtonState();
      });
      frame = frameId;
      return true;
    }

    function scrollToBottom({ smooth = false } = {}) {
      if (!mounted) return false;
      windowRef.scrollTo({
        top: scrollHeight(),
        behavior: smooth && !reduceMotion() ? 'smooth' : 'auto'
      });
      pinned = true;
      unseen = false;
      scheduleMeasure();
      return true;
    }

    function handleScroll() {
      if (!mounted) return false;
      const near = isNearBottom(metrics());
      pinned = near;
      if (near) unseen = false;
      scheduleMeasure();
      return true;
    }

    function handleMutation() {
      if (!mounted) return false;
      if (pinned) return scrollToBottom({ smooth: false });
      unseen = true;
      scheduleMeasure();
      return true;
    }

    function handleButtonClick() {
      return scrollToBottom({ smooth: true });
    }

    function acquireButton() {
      const existing = documentRef.querySelector(`#${BUTTON_ID}`);
      if (existing) return Object.freeze({ button: existing, owned: false });
      const node = documentRef.createElement('button');
      node.id = BUTTON_ID;
      node.type = 'button';
      node.className = 'scroll-to-latest';
      node.hidden = true;
      node.dataset.state = 'idle';
      node.textContent = '↓ En alta git';
      node.setAttribute('aria-label', 'Sohbetin en son mesajına git');
      documentRef.body?.append(node);
      return Object.freeze({ button: node, owned: true });
    }

    function mount() {
      if (mounted) return true;
      messages = documentRef.querySelector('#messages');
      if (!messages || !documentRef.body) return false;
      installStyles(documentRef);
      const acquired = acquireButton();
      button = acquired.button;
      buttonOwned = acquired.owned;
      if (!button) return false;
      generation += 1;
      mounted = true;
      button.addEventListener('click', handleButtonClick);
      windowRef.addEventListener('scroll', handleScroll, { passive: true });
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(handleMutation);
        observer.observe(messages, { childList: true, subtree: true, characterData: true });
      }
      pinned = isNearBottom(metrics());
      unseen = false;
      scheduleMeasure();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      generation += 1;
      observer?.disconnect?.();
      observer = null;
      windowRef.removeEventListener?.('scroll', handleScroll);
      button?.removeEventListener?.('click', handleButtonClick);
      if (frame !== null) cancelAnimationFrameImpl(frame);
      frame = null;
      if (buttonOwned) button?.remove?.();
      button = null;
      buttonOwned = false;
      messages = null;
      return true;
    }

    function snapshot() {
      return Object.freeze({
        mounted,
        generation,
        buttonOwned,
        framePending: frame !== null,
        pinned,
        unseen,
        nearBottom: isNearBottom(metrics())
      });
    }

    return Object.freeze({
      mount,
      destroy,
      snapshot,
      scheduleMeasure,
      handleScroll,
      handleMutation,
      handleButtonClick,
      scrollToBottom
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

  return Object.freeze({
    BUTTON_ID,
    STYLE_ID,
    NEAR_BOTTOM_PX,
    distanceToBottom,
    isNearBottom,
    installStyles,
    createController,
    mount
  });
});
