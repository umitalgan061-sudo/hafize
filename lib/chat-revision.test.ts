import {it,expect} from 'vitest';
import {revisionContext} from './chat-revision.ts';
const user=(content:string)=>({role:'user',content}), answer=(content:string)=>({role:'assistant',content});
it('recognizes successive editorial changes and leaves new subjects alone',()=>{
 const history=[user('Belediyeye aydınlatma hakkında bir mail yaz.'), answer('Sayın yetkili…'),user('Daha resmi yaz'),answer('Sayın ilgili…')];
 expect(revisionContext([...history,user('Biraz kısa yaz')])).toContain('hedef kitleyi');
 expect(revisionContext([...history,user('Yeni bir gezi planı yaz')])).toBeNull();
 expect(revisionContext([user('Bunu kısalt')])).toBeNull();
});
it('selects source code from the user when the previous reply was explanatory',()=>{
 expect(revisionContext([user('function toplam(a,b){return a-b}'),answer('İşaret yanlış.'),user('Sadece hatayı düzelt')])).toContain('kullanıcı mesajındaki kod');
});