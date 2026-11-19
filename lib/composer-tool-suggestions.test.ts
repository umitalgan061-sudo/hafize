import {it,expect} from 'vitest';
import {suggestTools} from './composer-tool-suggestions.ts';
it('recognizes Turkish requests and preserves unrelated chat',()=>{
  expect(suggestTools('DENEY KAYDINI doğrula')[0]?.url).toContain('#experiment-file');
  expect(suggestTools('Csv ve altyazi için yardım')).toHaveLength(2);
  expect(suggestTools('csvparser nedir')).toHaveLength(0);
  expect(suggestTools('/araçlar')).toHaveLength(5);
});