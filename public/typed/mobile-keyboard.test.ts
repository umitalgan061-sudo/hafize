import {describe,it,expect} from 'vitest';
import {mobileKeyboardGeometry,visualViewportBox} from './ui-shell.ts';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const keyboardBlock=(css:string)=>css.slice(css.indexOf('/* Keyboard up.'),css.indexOf('@keyframes hz-kb-welcome'));
describe('mobile composer viewport',()=>{
 it('anchors above keyboard, accounts for viewport panning, and restores on blur',()=>{
  expect(mobileKeyboardGeometry(844,480,0,true)).toEqual({active:true,bottom:364});
  expect(mobileKeyboardGeometry(844,480,80,true)).toEqual({active:true,bottom:284});
  expect(mobileKeyboardGeometry(844,480,80,false)).toEqual({active:false,bottom:0});
  expect(mobileKeyboardGeometry(844,800,0,true)).toEqual({active:false,bottom:0});
  expect(mobileKeyboardGeometry(844,480,0,true,1.5)).toEqual({active:false,bottom:0});
 });
 it('describes the visible part of the page in whole layout pixels',()=>{
  expect(visualViewportBox(512.4,339.6)).toEqual({top:340,height:512});
  expect(visualViewportBox(480,-12)).toEqual({top:0,height:480});
  expect(visualViewportBox(Number.NaN,Number.NaN)).toEqual({top:0,height:0});
 });
 it('uses native caret and does not intercept coarse-pointer selection',()=>{
  const css=read('../polish.css');
  expect(css).toContain('transform: none !important; -webkit-backdrop-filter: none');
  expect(css).toContain('caret-color: var(--premium-text)');
  const guard=read('../composer-focus-guard.js');
  expect(guard).toContain("window.matchMedia('(pointer: coarse)').matches");
 });
 it('never resizes or re-pads the composer when the keyboard opens, so the caret stays on the text',()=>{
  const block=keyboardBlock(read('../polish.css'));
  expect(block).toContain('bottom: var(--keyboard-bottom, 0px) !important;');
  const composerRules=block.match(/form#composer\.composer(?:\s+textarea#messageInput)?\s*\{[^}]*\}/g)??[];
  expect(composerRules.length).toBeGreaterThan(0);
  for(const rule of composerRules)expect(rule).not.toMatch(/padding|max-height|min-height|height:|border-width|font-size/);
 });
 it('keeps the header and a compact greeting above the keyboard instead of a blank screen',()=>{
  const css=read('../polish.css');
  const block=keyboardBlock(css);
  expect(block).not.toMatch(/\.welcome\s*\{\s*display:\s*none/);
  expect(block).toMatch(/\.app-shell\s*\{[^}]*position: fixed; top: var\(--hz-vv-top, 0px\)[^}]*height: var\(--hz-vv-height, 100%\)/);
  expect(block).toMatch(/\.welcome:not\(\.hidden\)\s*\{[^}]*display: flex/);
  expect(css).toMatch(/@container hz-kb-stage \(max-height: 215px\)/);
  const shell=read('./ui-shell.ts');
  expect(shell).toContain("html.style.setProperty('--hz-vv-top',box.top+'px')");
  expect(shell).toContain("html.style.removeProperty('--hz-vv-height')");
 });
});
describe('advanced view on phones',()=>{
 const css=read('../advanced-workspace.css');
 const phone=css.slice(css.indexOf('/* Advanced view, installed or in the browser, on a phone'));
 it('keeps the header on one row with an icon tool button and a status dot',()=>{
  expect(phone).toMatch(/\.main>\.topbar\{[^}]*flex-wrap:nowrap[^}]*height:calc\(66px \+ env\(safe-area-inset-top\)\)/);
  expect(phone).toMatch(/\.aw-top-label\{position:absolute;width:1px;height:1px/);
  expect(phone).toMatch(/#hafizeRuntimeStatus\{[^}]*font-size:0/);
  const ts=read('./advanced-workspace.ts');
  expect(ts).toContain("toggle.setAttribute('aria-label',toggle.title)");
 });
 it('lays the composer out as text, one scrolling tool row with send, then the model row',()=>{
  expect(phone).toContain('grid-template-areas:"tools tools send" "provider model prefs"');
  expect(phone).toMatch(/form#composer\.composer \.composer-tools\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/);
  expect(phone).toMatch(/form#composer\.composer \.composer-actions\{display:contents\}/);
  expect(css).toMatch(/@media \(pointer:coarse\)\{#composerHistoryHelp\{display:none!important\}\}/);
 });
 it('opens the send-history panel above the composer with its backup and privacy controls inside',()=>{
  const backup=read('./legacy/composer-history-backup.ts');
  expect(backup).not.toContain("prepend(wrapper) || form.after(wrapper)");
  expect(read('./legacy/composer-history-settings.ts')).toContain("if (historyPanel) historyPanel.append(panel); else form.after(panel);");
  expect(read('../composer-history.css')).toMatch(/#composerHistoryPanel\.composer-history-panel\{position:fixed;[^}]*bottom:calc\(var\(--composer-rise,200px\) \+ 8px\)/);
 });
});
