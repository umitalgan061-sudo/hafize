# Hafize mesaj Markdown sözleşmesi

## Amaç

Asistan yanıtlarının düz metin yerine okunabilir biçimlendirme ile sunulmasıdır.

Renderer bağımlılık gerektirmez ve tarayıcı tarafında çalışır. Sunucuya yeni endpoint eklemez.

## Desteklenen biçimler

- H1, H2 ve H3 başlıkları.
- Sırasız ve sıralı listeler.
- Paragraf blokları.
- Alıntı blokları.
- Yatay ayraç.
- Satır içi kod.
- Kalın ve italik metin.
- Çitli kod blokları.
- `http`, `https` ve `mailto` bağlantıları.

Tam Markdown standardının tüm ayrıntıları hedeflenmez. Desteklenmeyen sözdizimi düz metin olarak kalır.

## Veri sınırları

Girdi 24.000 karakterle sınırlandırılır.

Bir yanıt içinde en fazla 240 blok işlenir.

Bir satırın işlenen kısmı 1.200 karakterle sınırlıdır.

Kod bloklarının dili 24 karaktere kadar metadata olarak saklanır.

## DOM üretimi

Renderer `createElement`, `createTextNode` ve `textContent` kullanır.

User/model metni HTML olarak yorumlanmaz.

`innerHTML`, `outerHTML`, `document.write` ve `insertAdjacentHTML` kullanılmaz.

## Link politikası

Yalnızca `http`, `https` ve `mailto` protokolleri kabul edilir.

Harici bağlantılar yeni sekmede ve `noopener noreferrer` ile açılır.

Geçersiz veya izin verilmeyen bağlantılar link elementine dönüştürülmez.

## Kod blokları

Kod içeriği `textContent` ile atanır.

Kod alanlarına dil etiketi ve kopyalama düğmesi eklenebilir.

22 satırdan uzun kod bloklarında aç/kapa davranışı bulunur.

Kopyalama başarısız olursa kullanıcıya metinsel durum mesajı gösterilir.

## Streaming

SSE yanıtı parça parça güncellenirken enhancement katmanı MutationObserver ile değişiklikleri algılar.

Aynı kaynak yeniden verilirse ikinci kez parse edilmesini önlemek için kaynak imzası tutulur.

Renderer henüz yüklenmediyse enhancement sınırlı retry ile bekler.

## Sohbet modeli

Markdown sadece görsel sunum katmanıdır.

Yerel conversation storage hâlâ ham asistan metnini saklar.

Bu nedenle export, edit ve search işlemleri Markdown DOM'una bağımlı değildir.

## Kapsam dışı

Tablolar, resim embedleri, HTML, script, iframe, SVG ve özel URL şemaları bu sürümün dışındadır.

Markdown renderer sunucu tarafından üretilmiş güven sinyali veya güvenlik kararı olarak kullanılmamalıdır.
