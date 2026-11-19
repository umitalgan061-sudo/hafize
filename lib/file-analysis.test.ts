import {expect,it} from 'vitest';
import {groupValues,inspectPatch,parseCsv} from './file-analysis.ts';
it('handles multiline CSV, Turkish decimals and missing values',()=>{
  const rows=parseCsv('ilçe;bedel\n"Yeni;\nmahalle";3,5\n"Yeni;\nmahalle";2,5\nA;boş',';');
  expect(groupValues(rows,0,1,true)).toEqual({groups:[['Yeni;\nmahalle',{count:2,total:6}]],skipped:1});
  expect(()=>parseCsv('a,b\n"broken,3',',')).toThrow();
});
it('counts hunk lines and preserves the path for deletions',()=>{
  expect(inspectPatch('--- a/foo\n+++ b/foo\n@@ -8,2 +8,2 @@\n context\n-old\n+// TODO test\n--- a/bar\n+++ /dev/null\n@@ -1 +0,0 @@\n-x')).toEqual([
    {path:'foo',added:1,removed:1,notes:['L9 // TODO test']},{path:'bar',added:0,removed:1,notes:[]}
  ]);
});
