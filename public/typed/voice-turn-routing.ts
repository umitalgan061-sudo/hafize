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
  if (/^(?:bana )?(?:bir fıkra anlat|bir şaka yap|bir hikaye anlat|bir hikâye anlat|biraz konuşalım|sohbet edelim|moral ver|beni güldür|kendinden bahset|sence nasıl|anladım|çok güzel|harika|iyiyim|ben de iyiyim|teşekkür ederim iyiyim|sen nasılsın|peki sen|iyi sen nasılsın|evet|hayır|tamam|hı hı|aynen|doğru|bence de|haklısın|çok teşekkür ederim|günün nasıl geçti|bugün nasılsın|bugün nasıl gidiyor|nasıl hissediyorsun|seninle konuşmak istiyorum|seni özledim|beni anlıyor musun|çok mutluyum|çok üzgünüm|çok yorgunum)$/u.test(words)) return true;
  if (/^(?:ben de |ben |bugün |şu an )?(?:çok |biraz )?(?:iyiyim|fena değilim|keyfim iyi|keyfim yok|moralim iyi|moralim bozuk|canım sıkkın|çok şükür iyiyim|seni dinliyorum|sana bir şey anlatacağım|bir şey söyleyeceğim)(?: ya| işte| bugün)?$/u.test(words)) return true;
  if (/^(?:peki |hadi |tamam )?(?:anlat bakalım|sonra ne oldu|ne güzel|çok komik|çok iyi|anlıyorum|anladın mı|öyle mi|gerçekten mi|ciddi misin|sen ne dersin)$/u.test(words)) return true;
  if (/^(?:selam|merhaba|günaydın|iyi akşamlar|iyi geceler) (?:naber|ne haber|nasılsın|nasıl gidiyor)$/u.test(words)) return true;
  if (/^(?:ben |bugün |şu sıralar |kendimi )?(?:çok |biraz )?(?:yoruldum|yorgunum|mutluyum|üzgünüm|sıkıldım|iyi hissediyorum|kötü hissediyorum|moralim bozuk|canım sıkkın|keyfim yerinde|heyecanlıyım)$/u.test(words))return true;
  if (/^(?:bana |biraz )?(?:kendini tanıt|bir bilmece sor|bir masal anlat|bir örnek ver|bir tavsiye ver|biraz sohbet etmek istiyorum)$/u.test(words))return true;
  return /^(?:selam|merhaba|hey|günaydın|iyi sabahlar|iyi akşamlar|iyi geceler|naber|ne haber|nasılsın|nasılsınız|nasıl gidiyor|nasıl gidiyor her şey|beni duyuyor musun|sesim geliyor mu|orada mısın|ne yapıyorsun|ne yapıyorsun şu an|teşekkür ederim|teşekkürler|sağ ol|çok sağ ol|görüşürüz|hoşça kal|biraz sohbet edelim)$/u.test(words);
}
