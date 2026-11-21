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
  return /^(?:selam|merhaba|hey|günaydın|iyi sabahlar|iyi akşamlar|iyi geceler|naber|ne haber|nasılsın|nasılsınız|nasıl gidiyor|nasıl gidiyor her şey|beni duyuyor musun|sesim geliyor mu|orada mısın|ne yapıyorsun|ne yapıyorsun şu an|teşekkür ederim|teşekkürler|sağ ol|çok sağ ol|görüşürüz|hoşça kal|biraz sohbet edelim)$/u.test(words);
}
