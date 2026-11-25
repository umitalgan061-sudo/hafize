import {describe,it,expect} from 'vitest';
import {browserAuditExpression,browserViewport} from './browser-quality-audit.ts';
describe('fixed viewport quality audit',()=>{
 it('uses fixed bounded viewport presets',()=>{
 expect(browserViewport('mobile')).toEqual({width:390,height:844,mobile:true});
 expect(browserViewport('tablet').width).toBe(820);
 expect(browserViewport({width:90000})).toEqual(browserViewport('desktop'));
 });
 it('measures DOM without model-provided script or mutation',()=>{
 const expr=browserAuditExpression();
 expect(expr).toContain('horizontalOverflowPx');
 expect(expr).toContain('possiblyUnlabelledInputs');
 expect(expr).not.toMatch(/\.click\(|fetch\(|localStorage|document\.cookie|\.submit\(/);
 expect(()=>new Function('return '+expr)).not.toThrow();
 });
});
