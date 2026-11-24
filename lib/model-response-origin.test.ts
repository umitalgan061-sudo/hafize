import {it,expect} from 'vitest';
import {markCompletionOrigin,completionOrigin} from './model-response-origin.ts';
it('tracks the actual model per completion without trusting or modifying the response body',()=>{
 const a={model:'spoofed'},b={model:'spoofed'};
 expect(completionOrigin(a)).toBeNull();
 markCompletionOrigin(a,'nvidia/a');markCompletionOrigin(b,'nvidia/b');
 expect(completionOrigin(a)).toBe('nvidia/a');
 expect(completionOrigin(b)).toBe('nvidia/b');
 expect(JSON.stringify(a)).toBe('{"model":"spoofed"}');
 expect(completionOrigin({...a})).toBeNull();
});
