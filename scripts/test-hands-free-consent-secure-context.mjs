import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { canReview } = require('../public/hands-free-consent.js');
function toggle({disabled=false,pressed='false'}={}){return{disabled,getAttribute(name){return name==='aria-pressed'?pressed:null;}};}
assert.equal(canReview({hidden:false},{isSecureContext:true},toggle()),true);
assert.equal(canReview({hidden:false},{},toggle()),true);
assert.equal(canReview({hidden:true},{isSecureContext:true},toggle()),false);
assert.equal(canReview({hidden:false},{isSecureContext:false},toggle()),false);
assert.equal(canReview({hidden:false},{isSecureContext:true},toggle({disabled:true})),false);
assert.equal(canReview({hidden:false},{isSecureContext:true},toggle({pressed:'true'})),false);
assert.equal(canReview({hidden:false},{isSecureContext:true},null),false);
console.log('hands-free consent secure-context tests passed');
