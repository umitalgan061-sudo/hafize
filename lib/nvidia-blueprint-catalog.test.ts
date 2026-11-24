import {it,expect} from 'vitest';
import {BLUEPRINT_CATALOG,BLUEPRINT_META} from './nvidia-blueprint-catalog.ts';
import {checkMarkdown,searchPassages,evaluateCases} from '../public/typed/blueprint-workbench.ts';
it('inventories exactly 36 plans without claiming an official deployment',()=>{expect(BLUEPRINT_CATALOG).toHaveLength(36);expect(new Set(BLUEPRINT_CATALOG.map(x=>x.id)).size).toBe(36);expect(BLUEPRINT_META.total).toBe(36);expect(BLUEPRINT_CATALOG.every(x=>!x.officialDeployment)).toBe(true);expect(BLUEPRINT_CATALOG.filter(x=>x.mode==='local')).toHaveLength(3);});
it('audits markdown without executing code',()=>{expect(checkMarkdown('# Başlık\n### Alt\nTODO\n# Başlık').issues).toHaveLength(3);expect(checkMarkdown('# Başlık\n```\nTODO\n```').issues).toEqual([]);});
it('returns only matching source passages, no fabricated answer',()=>{expect(searchPassages('Ankara başkenttir.\n\nElma kırmızı.','Ankara').map(r=>r.source)).toEqual([1]);expect(searchPassages('Ankara','İstanbul')).toEqual([]);});
it('counts only valid explicit expected/actual pairs',()=>{expect(evaluateCases('42 | 42\nAnkara | Bursa\ninvalid')).toMatchObject({total:2,passed:1,invalid:1});});
