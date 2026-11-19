import {it,expect} from 'vitest';
import {calculationFor} from './chat-calculation.ts';
it('evaluates complete Turkish questions with precedence',()=>{
 expect(calculationFor('Hesapla: (10,5 + 4,5) × 2')).toContain('≈ 30');
 expect(calculationFor("250 TL’nin %18’i kaçtır?")).toContain('≈ 45');
 expect(calculationFor('12 / 0')).toBeNull();
 expect(calculationFor('Saat 12-15 arası')).toBeNull();
 expect(calculationFor('1.250 + 5')).toBeNull();
});