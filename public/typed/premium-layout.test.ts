import { describe, expect, it } from 'vitest';
import { COLUMN_PX, navLabel, sectionNames } from './premium-layout.ts';

describe('the side menu', () => {
  it('keeps an item\'s words and swaps only the glyph in front for a drawing', () => {
    expect(navLabel('✦ Sohbet')).toEqual({ label: 'Sohbet', icon: 'sohbet' });
    expect(navLabel('⚙︎ Ayarlar')).toEqual({ label: 'Ayarlar', icon: 'ayar' });
    expect(navLabel('＋ Yeni sohbet')).toEqual({ label: 'Yeni sohbet', icon: 'yeni' });
    expect(navLabel('◫ Tarayıcı')).toEqual({ label: 'Tarayıcı', icon: 'tarayici' });
  });

  it('leaves an item it has no drawing for as it is', () => {
    expect(navLabel('★ Başka bir şey').icon).toBe(null);
  });
});

describe('the Settings section links', () => {
  it('list each section once, in order, without empty names', () => {
    expect(sectionNames([' Hesap ', 'Sesler', '', 'Hesap', 'Bağlantılar'])).toEqual(['Hesap', 'Sesler', 'Bağlantılar']);
  });
});

describe('the reading column', () => {
  it('is as wide as the message box, so the two line up', () => {
    expect(COLUMN_PX).toBe(790);
  });
});
