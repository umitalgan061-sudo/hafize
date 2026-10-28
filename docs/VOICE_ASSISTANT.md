# Sesli Asistan

Hafize'in sesli asistanı üç modülden oluşur ve sohbet görünümünde doğrudan besteci
araç çubuğundan erişilebilir.

## Modüller

| Modül | Dosya | Sorumluluk |
|---|---|---|
| Sesli giriş | `public/typed/voice-input.ts` | Konuşmayı metne çevirir (SpeechRecognition) |
| Sesli yanıt | `public/typed/voice-output.ts` | Hafize yanıtlarını sesli okur (speechSynthesis) |
| Eller serbest | `public/typed/hands-free.ts` | Sürekli dinleme + otomatik yanıt döngüsü |

## Erişilebilirlik

`clean-ui.css` sohbet / tasks / connections çalışma alanlarında `.utility-rail` bölgesini
gizler. Bu nedenle sesli yanıt ve eller serbest düğmeleri besteci araç çubuğunda da
vardır ve aynı durumu paylaşır:

- `data-voice-toggle="output"` → sesli yanıt
- `data-voice-toggle="handsfree"` → eller serbest

Her iki konumdaki düğme de tek durumdan sürülür; biri değiştiğinde diğeri de güncellenir.

## Klavye kısayolu

`Ctrl+Shift+M` (macOS: `Cmd+Shift+M`) sesli girişimi açar / kapatır. Kısayol metin
kutusuna yazarken çalışır ve tarayıcı kısayoluyla çakışmaması için `preventDefault`
uygulanır.

## Düzeltilen hatalar

1. **Kelime kaybı (sesli giriş):** `readRecognitionText` yalnızca `resultIndex`'ten
   itibaren okuyordu. Tarayıcı `resultIndex` olarak "değişen sonucu" bildirdiği için
   aynı oturumda daha önce yazılmış kelimeler düşüyordu
   ("merhaba nasılsın" → "nasılsın"). Artık tüm sonuçlar indeks 0'dan okunuyor.
2. **Kullanıcı düzenlemesinin ezilmesi:** Dinleme sırasında metin kutusuna yazı
   yazılırsa bir sonraki sonuc eski öneki eziyordu. Artık `lastApplied` takibi
   sayesinde kullanıcının metni yeni önek olur.
3. **Firefox çökmesi:** `new SpeechSynthesisErrorEvent('error')` Firefox'ta mevcut
   değildir; hata yolu doğrudan durum sıfırlama ile değiştirildi.
4. **İlk kullanımda Türkçe sesin kaçırılması:** Chrome sesleri asenkron yükler;
   `voiceschanged` dinleyicisi eklenmediği için ilk denemede Türkçe ses
   seçilemiyordu.
5. **Sesli yanıt erişilemezdi:** Sohbet görünümünde `.utility-rail` gizli olduğu için
   sesli yanıt düğmesine hiç ulaşılamıyordu. Besteci araç çubuğuna eklendi.
6. **Desteklenmeyen tarayıcıda tıklanabilir mikrofon:** `SpeechRecognition` yoksa
   mikrofon düğmesi devre dışı bırakılır ve açıklama gösterir.
7. **Gizli sekmede konuşma:** `speak` ve `next` artık `document.hidden` durumunda
   çalışmaz; sekme gizlendiğinde kuyruk iptal edilir.

## Görsel durumlar

`public/voice-states.css` tema değişkenleriyle çalışan durum görselleri sunar:

- `#composer[data-voice-listening="true"]` — kırmızı çerçeve (dinliyor)
- `#composer[data-hands-free="true"]` — mor çerçeve (eller serbest)
- `#composer.voice-speaking` — yeşil çerçeve (sesli yanıt okuyor)
- `#voiceOutputBtn[aria-pressed="true"]` / `#handsFreeBtn[aria-pressed="true"]` — vurgu
  arka plan + nabız halkası
- `#micBtn[disabled]` — üstü çizili (desteklenmiyor)

Tüm animasyonlar `prefers-reduced-motion: reduce` altında durur.

## Testler

`public/typed/voice-transcripts.test.ts` (12 test) saf fonksiyonları doğrular:

- `readRecognitionText` — tüm sonuçları okur, bozuk olayları yok sayar
- `mergeTranscript` / `normalizeTranscript` — birleştirme ve uzunluk bütçesi
- `normalizeSpeechText` — kod bloğu, bağlantı ve markdown temizliği
- `splitSpeechText` — cümle sınırlarını koruyarak parçalama
