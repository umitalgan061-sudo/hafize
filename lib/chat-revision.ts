type Turn = {role?:string; content?:unknown};

// Only complete editing commands qualify. A new subject or pasted source uses normal chat.
function revisionCommand(text:string):'code'|'prose'|null {
  const q=text.trim().toLocaleLowerCase('tr-TR').replace(/[.!?]+$/,'').replace(/\s+/g,' ');
  if (/^(?:(?:bu kodda|kodda) )?(?:sadece|yalnızca) (?:bu )?hatayı düzelt$/.test(q)) return 'code';
  if (/^(?:(?:bunu|bu metni|önceki yanıtı|son yanıtı) )?(?:(?:biraz |daha )?(?:kısa|resmi|resmî|samimi|anlaşılır|sade) (?:yaz|yap)|kısalt|sadeleştir|özetle|madde madde yaz|yeniden yaz)$/.test(q)) return 'prose';
  return null;
}
export function revisionContext(turns:Turn[]):string|null {
  const end=turns.length-1, last=turns[end];
  if(last?.role!=='user'||typeof last.content!=='string'||last.content.length>160)return null;
  const kind=revisionCommand(last.content);
  if(!kind)return null;
  const previous=turns[end-1];
  if(previous?.role!=='assistant'||typeof previous.content!=='string'||!previous.content.trim())return null;
  // Find the original request within this contiguous sequence of revisions.
  let root=end-2;
  while(root>=2 && end-root<16 && turns[root]?.role==='user' && typeof turns[root]?.content==='string' &&
    revisionCommand(turns[root]!.content as string) && turns[root-1]?.role==='assistant') root-=2;
  const request=turns[root];
  if(request?.role!=='user'||typeof request.content!=='string'||revisionCommand(request.content))return null;
  const original=request.content;
  if(kind==='code'){
    const containsCode=(s:string)=>/```[^\n]*\n|\bfunction\s+\w+\s*\(|\bdef\s+\w+\s*\(|<!doctype html>/i.test(s);
    const target=containsCode(previous.content)?'bir önceki yanıttaki kod':containsCode(original)?'bu düzenleme dizisini başlatan kullanıcı mesajındaki kod':null;
    if(!target)return null;
    return 'Düzenlenecek kaynak: '+target+'. Kullanıcının bildirdiği hatayı ve mevcut çağrı biçimini esas al. İlgisiz davranışı ve adları koru. Çalıştırma çıktısı yoksa test edildiğini söyleme.';
  }
  return 'Bir önceki asistan yanıtının metnini düzenle. Bu düzenleme dizisini başlatan kullanıcı isteğindeki hedef kitleyi, olguları, özel adları ve hâlâ geçerli kısıtları koru. Son istekte değiştirilen özellik önceliklidir. Düzenlenmiş metni doğrudan ver.';
}
