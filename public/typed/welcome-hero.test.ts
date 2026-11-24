import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../premium.css',import.meta.url),'utf8');
const hero=readFileSync(new URL('../original-hero.js',import.meta.url),'utf8');

describe('welcome portrait single renderer',()=>{
  it('reserves the original canvas at first paint, with no autoplay video or second renderer',()=>{
    expect(html).toContain('id="welcome" class="welcome hz-hero-on"');
    expect(html.match(/<canvas class="hz-hero"/g)).toHaveLength(1);
    expect(html.match(/src="\/original-hero-bootstrap\.js"/g)).toHaveLength(1);
    expect(html).not.toMatch(/heroPointPortrait|heroPointCanvas|syncPortraitMotion|hafize-point-portrait/);
  });
  it('hides the alternate logo before the module is executed and keeps the error fallback static',()=>{
    expect(css).toMatch(/\.hz-hero-on \.hero-logo\s*\{\s*display:\s*none\s*!important/);
    expect(css).toMatch(/\.hz-hero-fallback \.hero-logo\s*\{\s*animation:\s*none\s*!important/);
    expect(css).not.toContain('hero-point-portrait');
  });
  it('mounts the existing canvas once and assembles before rotating',()=>{
    expect(hero).toContain("if (!welcome || welcome.dataset.heroMounted) return;");
    expect(hero).toContain("welcome.querySelector('.hz-hero')");
    expect(hero).not.toContain("createElement('canvas')");
    expect(hero).toContain('state.lastStep && !gathering');
    expect(hero).toContain("getPropertyValue('--premium-orange')");
  });
});
