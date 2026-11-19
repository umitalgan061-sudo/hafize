import {it,expect} from 'vitest';
import {calculationFor,conversationCalculation} from './chat-calculation.ts';
it('evaluates complete Turkish questions with precedence',()=>{
 expect(calculationFor('Hesapla: (10,5 + 4,5) × 2')).toContain('≈ 30');
 expect(calculationFor("250 TL’nin %18’i kaçtır?")).toContain('≈ 45');
 expect(calculationFor('12 / 0')).toBeNull();
 expect(calculationFor('Saat 12-15 arası')).toBeNull();
 expect(calculationFor('1.250 + 5')).toBeNull();
});
const ask=(...texts:string[])=>conversationCalculation(texts.flatMap(content=>[{role:'assistant',content:'Önceki yanıt'},{role:'user',content}]));
it('distinguishes the original amount from the result, including consecutive follow-ups',()=>{
 expect(ask("250 TL’nin %18’i kaçtır?", "Peki ya %20’si?")).toBe('250 × 20 / 100 ≈ 50');
 expect(ask("250 TL’nin %18’i kaçtır?", "Sonucun %20’si?")).toBe('45 × 20 / 100 ≈ 9');
 expect(ask("250 TL’nin %18’i kaçtır?", "Peki %20?", "Peki %10?")).toBe('250 × 10 / 100 ≈ 25');
 expect(ask('12+8','Sonucun yüzde 25’i?')).toContain('≈ 5');
});
it('does not guess when the context is absent, ambiguous or changed',()=>{
 expect(ask('Peki ya %20’si?')).toBeNull();
 expect(ask('12+8','Peki ya %20’si?')).toBeNull();
 expect(ask("250 TL’nin %18’i kaçtır?",'Ankara hakkında konuşalım','Peki %10?')).toBeNull();
});
