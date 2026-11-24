import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { resolveUiLayout, installLayoutMode } from './ui-shell.ts';

const root = new URL('../../', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');

describe('Hafize classic interface restoration', () => {
  it('defaults to the complete classic layout', () => {
    expect(resolveUiLayout(undefined)).toBe('classic');
    expect(resolveUiLayout(null)).toBe('classic');
    expect(resolveUiLayout('unknown')).toBe('classic');
    expect(resolveUiLayout('focused')).toBe('focused');
  });

  it('retains the historic chat, sidebar and tool surfaces in the HTML', () => {
    const html = read('public/index.html');
    expect(html).toContain('data-hafize-layout="classic"');
    expect(html).toContain('id="layoutToggle"');
    expect(read('public/theme-init.js')).toContain("localStorage.getItem('hafize.ui-layout.v1')");
    expect(Number(read('public/sw-policy.ts').match(/CURRENT_CACHE[^\n]*v(\d+)/)?.[1])).toBeGreaterThanOrEqual(185);
    for (const id of ['sidebar', 'agentSelect', 'newChatBtn', 'conversationList', 'toolModeBtn', 'composer', 'voiceProxy']) {
      expect(html).toContain('id="' + id + '"');
    }
  });

  it('limits control hiding to explicitly selected focused layout', () => {
    const css = read('public/clean-ui.css');
    const prefix = 'html[data-hafize-layout="focused"] ';
    // The utility rail is intentionally nested under a workspace-specific .main selector.
    expect(css).toContain(prefix + '.main:not([data-workspace="settings"])');
    expect(css).toContain('> .utility-rail {');
    for (const selector of [
      '#toolModeBtn', '#modelPreferencesButton',
      '#sidebar .brand-row', '.message .assistant-message-actions'
    ]) {
      expect(css).toContain(prefix + selector);
    }
    expect(css).not.toContain('\n#toolModeBtn,');
    expect(css).not.toContain('\n#modelPreferencesButton,');
    expect(css).toContain('.utility-rail [hidden]');
  });

  it('toggles and remembers the layout without changing chat data', () => {
    const attributes = new Map<string, string>();
    const listeners = new Map<string, () => void>();
    const values = new Map<string, string>();
    const label = { textContent: '' };
    const button = {
      setAttribute: (key: string, value: string) => { attributes.set(key, value); },
      querySelector: () => label,
      addEventListener: (event: string, listener: () => void) => { listeners.set(event, listener); },
      removeEventListener: (event: string) => { listeners.delete(event); }
    };
    const html = { dataset: { hafizeLayout: 'classic' } };
    const doc = {
      documentElement: html, querySelector: () => button
    } as unknown as Document;
    const fakeWindow = {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); }
      },
      dispatchEvent: () => true
    } as unknown as Window & typeof globalThis;
    const dispose = installLayoutMode(doc, fakeWindow);
    expect(html.dataset.hafizeLayout).toBe('classic');
    expect(attributes.get('aria-pressed')).toBe('true');
    listeners.get('click')?.();
    expect(html.dataset.hafizeLayout).toBe('focused');
    expect(attributes.get('aria-pressed')).toBe('false');
    expect(values.get('hafize.ui-layout.v1')).toBe('focused');
    listeners.get('click')?.();
    expect(html.dataset.hafizeLayout).toBe('classic');
    expect(values.get('hafize.ui-layout.v1')).toBe('classic');
    dispose();
    expect(listeners.has('click')).toBe(false);
  });

  it('respects a saved focused setting and safely defaults if storage is unavailable', () => {
    const html = { dataset: { hafizeLayout: 'classic' } };
    const fakeDoc = { documentElement: html, querySelector: () => null } as unknown as Document;
    const withPreference = { localStorage: { getItem: () => 'focused' } } as unknown as Window & typeof globalThis;
    installLayoutMode(fakeDoc, withPreference);
    expect(html.dataset.hafizeLayout).toBe('focused');
    const blocked = { get localStorage(): Storage { throw new Error('blocked'); } } as unknown as Window & typeof globalThis;
    installLayoutMode(fakeDoc, blocked);
    expect(html.dataset.hafizeLayout).toBe('classic');
  });
});
