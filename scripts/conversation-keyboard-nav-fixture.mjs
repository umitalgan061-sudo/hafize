import assert from 'node:assert/strict';

export function makeButton(name, {
  rowHidden = false,
  hidden = false,
  disabled = false,
  focusThrows = false,
  scrollThrows = false,
  editable = false
} = {}) {
  const row = { hidden: rowHidden };
  return {
    name,
    tagName: editable ? 'INPUT' : 'BUTTON',
    hidden,
    disabled,
    isContentEditable: false,
    focused: 0,
    scrolled: 0,
    lastFocusOptions: null,
    lastScrollOptions: null,
    classList: { contains: (value) => value === 'conversation-open' },
    closest(selector) { return selector === '.conversation-row' ? row : null; },
    focus(options) {
      if (focusThrows) throw new Error('focus failed');
      this.focused += 1;
      this.lastFocusOptions = options;
    },
    scrollIntoView(options) {
      if (scrollThrows) throw new Error('scroll failed');
      this.scrolled += 1;
      this.lastScrollOptions = options;
    }
  };
}

export function makeList(buttons = [makeButton('a'), makeButton('b'), makeButton('c')], {
  addThrows = false,
  removeThrows = false,
  queryThrows = false
} = {}) {
  const listeners = new Map();
  return {
    buttons,
    listeners,
    addCalls: 0,
    removeCalls: 0,
    querySelectorAll(selector) {
      assert.equal(selector, '.conversation-open');
      if (queryThrows) throw new Error('query failed');
      return this.buttons;
    },
    addEventListener(type, listener) {
      this.addCalls += 1;
      assert.equal(type, 'keydown');
      if (addThrows) throw new Error('listener install failed');
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      this.removeCalls += 1;
      assert.equal(type, 'keydown');
      if (removeThrows) throw new Error('listener removal failed');
      const entries = listeners.get(type) || [];
      listeners.set(type, entries.filter((entry) => entry !== listener));
    },
    listener(type = 'keydown', index = 0) {
      return listeners.get(type)?.[index] || null;
    },
    listenerCount(type = 'keydown') {
      return listeners.get(type)?.length || 0;
    }
  };
}

export function makeDocument(list, { queryThrows = false } = {}) {
  let currentList = list;
  let shouldThrow = queryThrows;
  return {
    queryCalls: 0,
    querySelector(selector) {
      this.queryCalls += 1;
      assert.equal(selector, '#conversationList');
      if (shouldThrow) throw new Error('document query failed');
      return currentList;
    },
    replaceList(next) { currentList = next; },
    setQueryThrows(value) { shouldThrow = Boolean(value); },
    currentList: () => currentList
  };
}

export function makeHarness(options = {}) {
  const buttons = options.buttons || [makeButton('a'), makeButton('b'), makeButton('c')];
  const list = makeList(buttons, options.listOptions);
  const documentRef = makeDocument(list, options.documentOptions);
  return { buttons, list, documentRef };
}

export function eventFor(target, key, extras = {}) {
  return {
    target,
    key,
    defaultPrevented: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    prevented: 0,
    preventDefault() { this.prevented += 1; },
    ...extras
  };
}

export function assertMoved(event, source, target) {
  assert.equal(event.prevented, 1, 'handled navigation prevents the browser default');
  assert.equal(source.focused, 0, 'source is not refocused');
  assert.equal(target.focused, 1, 'target receives focus once');
  assert.deepEqual(target.lastFocusOptions, { preventScroll: true });
  assert.equal(target.scrolled, 1, 'target receives one bounded scroll request');
  assert.deepEqual(target.lastScrollOptions, { block: 'nearest', inline: 'nearest' });
}
