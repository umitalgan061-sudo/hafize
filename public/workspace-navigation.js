(function exposeHafizeWorkspaceNavigation(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeWorkspaceNavigation = api;
  const install = () => api.mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeWorkspaceNavigation() {
  'use strict';

  const WORKSPACES = Object.freeze(['chat', 'tasks', 'connections']);
  const NAV_IDS = Object.freeze({
    chat: 'navChatBtn',
    tasks: 'navTasksBtn',
    connections: 'navConnectionsBtn'
  });
  const CARD_IDS = Object.freeze({
    tasks: Object.freeze(['scheduleRuntimeCard', 'scheduleListCard']),
    connections: Object.freeze(['accountConnectionCard', 'canvaConnectionCard', 'githubWriteReadinessCard'])
  });
  const INTRO_ID = 'workspaceNavigationIntro';
  const STYLE_ID = 'workspaceNavigationStyle';
  const STYLE_PATH = '/workspace-navigation.css';
  const CHANGE_EVENT = 'hafize:workspace-changed';
  const ACTIVE_MAINS = new WeakSet();

  const COPY = Object.freeze({
    tasks: Object.freeze({
      eyebrow: 'Bulut görevleri',
      title: 'Görevler',
      description: 'Planlanmış ajan çalışmalarını, çalışma motorunun durumunu ve geçmiş görevleri tek yerde yönet.'
    }),
    connections: Object.freeze({
      eyebrow: 'Güvenli bağlantılar',
      title: 'Bağlantılar',
      description: 'Hesap, Gmail, Canva ve GitHub bağlantı sınırlarını tek çalışma alanında kontrol et.'
    })
  });

  function normalizeWorkspace(value) {
    return typeof value === 'string' && WORKSPACES.includes(value) ? value : 'chat';
  }

  function allowedCardIds(workspace) {
    const key = normalizeWorkspace(workspace);
    return CARD_IDS[key] || Object.freeze([]);
  }

  function isWorkspaceCard(node, workspace) {
    const id = typeof node?.id === 'string' ? node.id : '';
    return Boolean(id && allowedCardIds(workspace).includes(id));
  }

  function workspaceCopy(workspace) {
    const key = normalizeWorkspace(workspace);
    return COPY[key] || null;
  }

  function snapshotAttribute(node, name) {
    const value = node?.getAttribute?.(name);
    return Object.freeze({ present: value !== null && value !== undefined, value });
  }

  function restoreAttribute(node, name, snapshot) {
    if (!node || !snapshot) return;
    if (snapshot.present) node.setAttribute?.(name, snapshot.value ?? '');
    else node.removeAttribute?.(name);
  }

  function ensureStyle(documentRef) {
    if (!documentRef?.head || typeof documentRef.createElement !== 'function') return null;
    const existing = documentRef.getElementById?.(STYLE_ID);
    if (existing) return Object.freeze({ node: existing, owned: false });
    const link = documentRef.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = STYLE_PATH;
    link.setAttribute('data-hafize-workspace-navigation-style', '1');
    documentRef.head.append(link);
    return Object.freeze({ node: link, owned: true });
  }

  function createIntro(documentRef) {
    const section = documentRef.createElement('section');
    section.id = INTRO_ID;
    section.className = 'workspace-navigation-intro';
    section.hidden = true;
    section.tabIndex = -1;
    section.setAttribute('aria-live', 'polite');

    const eyebrow = documentRef.createElement('span');
    eyebrow.className = 'workspace-navigation-eyebrow';
    const title = documentRef.createElement('h1');
    title.className = 'workspace-navigation-title';
    const description = documentRef.createElement('p');
    description.className = 'workspace-navigation-description';

    section.append(eyebrow, title, description);
    return Object.freeze({ section, eyebrow, title, description });
  }

  function dispatchWorkspaceEvent(rootRef, workspace) {
    if (typeof rootRef?.dispatchEvent !== 'function') return false;
    const detail = Object.freeze({ workspace: normalizeWorkspace(workspace) });
    try {
      const EventImpl = rootRef.CustomEvent || globalThis.CustomEvent;
      if (typeof EventImpl === 'function') {
        rootRef.dispatchEvent(new EventImpl(CHANGE_EVENT, { detail }));
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function createController({
    documentRef = globalThis.document,
    rootRef = globalThis,
    MutationObserverImpl = rootRef?.MutationObserver
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_WORKSPACE_NAVIGATION_DOCUMENT');
    }

    const main = documentRef.querySelector('.main');
    const primary = documentRef.querySelector('.primary-column');
    const rail = documentRef.querySelector('.utility-rail');
    const nav = Object.fromEntries(WORKSPACES.map((workspace) => [workspace, documentRef.getElementById?.(NAV_IDS[workspace])]));
    if (!main || !primary || !rail || WORKSPACES.some((workspace) => !nav[workspace])) {
      throw new Error('WORKSPACE_NAVIGATION_HOST_UNAVAILABLE');
    }

    let mounted = false;
    let destroyed = false;
    let current = 'chat';
    let observer = null;
    let style = null;
    let intro = null;
    let introOwned = false;
    const listeners = [];
    const managedCards = new Set();
    const cardSnapshots = new Map();

    const hostSnapshot = Object.freeze({
      mainWorkspace: snapshotAttribute(main, 'data-workspace'),
      railLabel: snapshotAttribute(rail, 'aria-label'),
      primaryHidden: Boolean(primary.hidden),
      nav: Object.freeze(Object.fromEntries(WORKSPACES.map((workspace) => {
        const button = nav[workspace];
        return [workspace, Object.freeze({
          disabled: Boolean(button.disabled),
          active: button.classList?.contains?.('active') === true,
          current: snapshotAttribute(button, 'aria-current')
        })];
      })))
    });

    function addListener(target, type, handler) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('WORKSPACE_NAVIGATION_EVENT_TARGET_UNSAFE');
      }
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    }

    function snapshotCard(node) {
      if (!node || node === intro?.section || cardSnapshots.has(node)) return;
      cardSnapshots.set(node, Object.freeze({ hidden: Boolean(node.hidden) }));
      managedCards.add(node);
    }

    function restoreCards() {
      for (const node of managedCards) {
        const snapshot = cardSnapshots.get(node);
        if (!snapshot) continue;
        node.hidden = snapshot.hidden;
      }
    }

    function syncCards() {
      const children = Array.from(rail.children || []);
      for (const node of children) snapshotCard(node);
      if (current === 'chat') {
        restoreCards();
        return;
      }
      for (const node of managedCards) {
        if (!node || node === intro?.section) continue;
        node.hidden = !isWorkspaceCard(node, current);
      }
    }

    function renderIntro() {
      if (!intro) return;
      const copy = workspaceCopy(current);
      if (!copy) {
        intro.section.hidden = true;
        return;
      }
      intro.eyebrow.textContent = copy.eyebrow;
      intro.title.textContent = copy.title;
      intro.description.textContent = copy.description;
      intro.section.hidden = false;
    }

    function renderNavigation() {
      for (const workspace of WORKSPACES) {
        const active = workspace === current;
        nav[workspace].classList?.toggle?.('active', active);
        if (active) nav[workspace].setAttribute?.('aria-current', 'page');
        else nav[workspace].removeAttribute?.('aria-current');
      }
    }

    function renderHost({ focus = false } = {}) {
      main.setAttribute?.('data-workspace', current);
      primary.hidden = current !== 'chat';
      rail.setAttribute?.('aria-label', current === 'chat'
        ? (hostSnapshot.railLabel.value || 'Hafize yardımcı araçları')
        : current === 'tasks' ? 'Hafize görevler çalışma alanı' : 'Hafize bağlantılar çalışma alanı');
      renderNavigation();
      renderIntro();
      syncCards();
      if (focus && current !== 'chat') intro?.section?.focus?.();
    }

    function setWorkspace(value, { focus = false, emit = true } = {}) {
      if (destroyed) return false;
      const next = normalizeWorkspace(value);
      if (next === current) {
        renderHost({ focus });
        return false;
      }
      current = next;
      renderHost({ focus });
      if (emit) dispatchWorkspaceEvent(rootRef, current);
      return true;
    }

    function closeSidebarAfterNavigation() {
      const sidebar = documentRef.getElementById?.('sidebar');
      const toggle = documentRef.getElementById?.('sidebarToggle');
      if (sidebar?.classList?.contains?.('open') !== true) return;
      if (typeof toggle?.click === 'function') toggle.click();
    }

    function onNav(workspace) {
      return (event) => {
        event?.preventDefault?.();
        if (nav[workspace].disabled) return;
        setWorkspace(workspace, { focus: workspace !== 'chat' });
        closeSidebarAfterNavigation();
      };
    }

    function mount() {
      if (mounted || destroyed || ACTIVE_MAINS.has(main)) return false;
      style = ensureStyle(documentRef);
      if (!style) return false;

      const existingIntro = documentRef.getElementById?.(INTRO_ID);
      if (existingIntro) return false;
      intro = createIntro(documentRef);
      try {
        rail.prepend?.(intro.section);
        if (!intro.section.parentNode && typeof rail.insertBefore === 'function') rail.insertBefore(intro.section, rail.firstChild || null);
        if (!intro.section.parentNode) throw new Error('WORKSPACE_NAVIGATION_INTRO_ATTACH_FAILED');
        introOwned = true;
        for (const workspace of WORKSPACES) addListener(nav[workspace], 'click', onNav(workspace));
      } catch {
        while (listeners.length) {
          try { listeners.pop()(); } catch {}
        }
        if (introOwned) intro.section.remove?.();
        if (style?.owned) style.node.remove?.();
        intro = null;
        style = null;
        introOwned = false;
        return false;
      }

      ACTIVE_MAINS.add(main);
      mounted = true;
      nav.tasks.disabled = false;
      nav.connections.disabled = false;
      current = 'chat';
      renderHost();

      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => {
          if (!destroyed) syncCards();
        });
        observer.observe(rail, { childList: true });
      }
      return true;
    }

    function destroy() {
      if (!mounted || destroyed) return false;
      destroyed = true;
      observer?.disconnect?.();
      observer = null;
      while (listeners.length) {
        try { listeners.pop()(); } catch {}
      }
      restoreCards();
      if (introOwned) intro?.section?.remove?.();
      if (style?.owned) style.node.remove?.();
      restoreAttribute(main, 'data-workspace', hostSnapshot.mainWorkspace);
      restoreAttribute(rail, 'aria-label', hostSnapshot.railLabel);
      primary.hidden = hostSnapshot.primaryHidden;
      for (const workspace of WORKSPACES) {
        const snapshot = hostSnapshot.nav[workspace];
        nav[workspace].disabled = snapshot.disabled;
        nav[workspace].classList?.toggle?.('active', snapshot.active);
        restoreAttribute(nav[workspace], 'aria-current', snapshot.current);
      }
      ACTIVE_MAINS.delete(main);
      mounted = false;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      setWorkspace,
      getWorkspace: () => current,
      syncCards
    });
  }

  function mount(documentRef, rootRef) {
    try {
      const controller = createController({ documentRef, rootRef, MutationObserverImpl: rootRef?.MutationObserver });
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    WORKSPACES,
    NAV_IDS,
    CARD_IDS,
    INTRO_ID,
    STYLE_ID,
    STYLE_PATH,
    CHANGE_EVENT,
    normalizeWorkspace,
    allowedCardIds,
    isWorkspaceCard,
    workspaceCopy,
    createController,
    mount
  });
});
