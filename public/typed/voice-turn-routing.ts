// Only low-stakes conversational turns use the direct streaming chat endpoint.
// Factual/tool-seeking questions continue through the normal agent runtime.
export function isLightweightVoiceTurn(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const words = value.toLocaleLowerCase('tr-TR')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:hey |selam )?hafize /u, '')
    .replace(/ hafize$/u, '');
  if (!words || words.length > 240 || /\b(?:github|render|firebase|api|kod|dosya|internet|web|google|haberler|hava|döviz|borsa|fiyat|rezervasyon|randevu|hatırlat|araştır|gönder|yayınla|indir|kurulum|sil|satın|bugünkü|güncel|son dakika)\b/u.test(words)) return false;
  if (/^(?:bana )?(?:bir fıkra anlat|bir şaka yap|bir hikaye anlat|bir hikâye anlat|biraz konuşalım|sohbet edelim|moral ver|beni güldür|kendinden bahset|sence nasıl|bunu biraz aç|biraz daha anlat|devam et bakalım|anladım|çok güzel|harika|iyiyim|ben de iyiyim|teşekkür ederim iyiyim|sen nasılsın|peki sen|iyi sen nasılsın|evet|hayır|tamam|hı hı|aynen|doğru|bence de|haklısın|çok teşekkür ederim|günün nasıl geçti)$/u.test(words)) return true;
  if (/^(?:selam|merhaba|günaydın|iyi akşamlar|iyi geceler) (?:naber|ne haber|nasılsın|nasıl gidiyor)$/u.test(words)) return true;
  return /^(?:selam|merhaba|hey|günaydın|iyi sabahlar|iyi akşamlar|iyi geceler|naber|ne haber|nasılsın|nasılsınız|nasıl gidiyor|nasıl gidiyor her şey|beni duyuyor musun|sesim geliyor mu|orada mısın|ne yapıyorsun|ne yapıyorsun şu an|teşekkür ederim|teşekkürler|sağ ol|çok sağ ol|görüşürüz|hoşça kal|biraz sohbet edelim)$/u.test(words);
}
