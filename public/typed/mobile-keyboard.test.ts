import {describe,it,expect} from 'vitest';
import {mobileKeyboardGeometry} from './ui-shell.ts';
import {readFileSync} from 'node:fs';
describe('mobile composer viewport',()=>{
 it('anchors above keyboard, accounts for viewport panning, and restores on blur',()=>{
  expect(mobileKeyboardGeometry(844,480,0,true)).toEqual({active:true,bottom:364});
  expect(mobileKeyboardGeometry(844,480,80,true)).toEqual({active:true,bottom:284});
  expect(mobileKeyboardGeometry(844,480,80,false)).toEqual({active:false,bottom:0});
  expect(mobileKeyboardGeometry(844,800,0,true)).toEqual({active:false,bottom:0});
  expect(mobileKeyboardGeometry(844,480,0,true,1.5)).toEqual({active:false,bottom:0});
 });
 it('uses native caret and does not intercept coarse-pointer selection',()=>{
  const css=readFileSync(new URL('../polish.css',import.meta.url),'utf8');
  expect(css).toContain('transform: none !important; -webkit-backdrop-filter: none');
  expect(css).toContain('caret-color: var(--premium-text)');
  const guard=readFileSync(new URL('../composer-focus-guard.js',import.meta.url),'utf8');
  expect(guard).toContain("window.matchMedia('(pointer: coarse)').matches");
 });
});
