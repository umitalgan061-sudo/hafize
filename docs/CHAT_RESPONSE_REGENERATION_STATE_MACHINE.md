# Yanıt Yeniden Üretme Durum Makinesi

## Idle
Son assistant yanıtı görünür. Yeniden üret eylemi yalnız son mesajda etkin.

## Starting
Kullanıcı Yeniden üret seçtiğinde ağ, model ve ajan kontrol edilir. Uygunsa streaming state başlar.

## Streaming
Composer, agent seçimi ve tool mode kilitlenir. Mevcut yanıt yeni stream ile doldurulur.

## Commit
Stream başarıyla biterse eski içerik alternate history içine alınır. Generation metadata güncellenir ve local storage yazılır.

## Restore
Önceki yanıt geri getirildiğinde son alternate aktif içerik yapılır; önceki aktif içerik history başına eklenir.

## Failure
Stream başarısız olursa eski içerik geri konur. Alternatif history değişmez. Kullanıcıya hata toast'ı gösterilir.

## Feedback
Positive veya negative state ayrı bir küçük state makinesidir. Toggle kapatılabilir.

## Destroy
Sayfa kapanırken mevcut conversation lifecycle davranışı devam eder.

## Invariantlar
- Aynı anda tek generation.
- 3'ten fazla alternate yok.
- Alternatifler requestMessages içine girmez.
- Regen submit değildir.
