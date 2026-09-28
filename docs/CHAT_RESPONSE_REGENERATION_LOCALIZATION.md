# Yanıt Regeneration Yerelleştirme

## Türkçe metinler
Action labels ve status messages Türkçe tutulur.

## Semantik
aria-label metinleri görünür button metinleriyle aynı anlamı taşımalıdır.

## Değişken içerik
Model ve agent isimleri kullanıcı kontrollü string kabul edilir ve textContent ile eklenir.

## Tarih
Generation timestamp ISO olarak saklanır; yalnız kullanıcıya gösterim sırasında lokal saate çevrilebilir.

## Sayılar
Duration integer milliseconds olarak normalize edilir.

## İleri diller
Yeni locale eklenecekse action key'leri sabit source string yerine merkezi çeviri sözleşmesine taşınabilir; bu turda yeni dependency eklenmez.

## Test
Kaynak sözleşmesi Türkçe action labels ve accessibility labels için smoke test içerir.
