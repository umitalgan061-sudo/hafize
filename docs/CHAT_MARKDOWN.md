# Hafize Chat Markdown

## Amaç

Asistan yanıtları düz metin yerine güvenli ve sınırlı bir Markdown katmanından geçirilir. Katman yalnız istemci tarafındaki sohbet görünümünü değiştirir; sunucu API sözleşmesi, model seçimi, tool-calling ve konuşma kalıcı verisi değiştirilmez.

## Desteklenen bloklar

Başlıklar `h1` ile başlanmaz; uygulamanın kendi başlık hiyerarşisini korumak için model başlığı en fazla `h3` olur. Paragraflar boş satırlara göre ayrılır. Yumuşak satır kırılmaları tek paragrafta birleştirilir.

Sıralı ve sırasız listeler, başlangıç numarası taşıyan sıralı listeler, görev listeleri, alıntı blokları ve yatay çizgiler desteklenir. Görev işaretleri yalnız görsel durum göstergesidir; model metni değişmez.

Çok satırlı kod blokları üçlü backtick veya tilde fence ile açılır. Dil etiketi güvenli bir tanımlayıcıya indirgenir ve sınıf adına dönüştürülür. Kapanmamış fence, streaming sırasında normal bir ara durum olarak kabul edilir ve mevcut içerik kod bloğu olarak çizilir.

Pipe tabloları başlık + ayırıcı satır yapısıyla tanınır. Hücreler sol, orta veya sağ hizalanabilir. Geniş tablolar yatay kaydırılır; görünüm sayfa genişliğini zorlamaz.

Satır içinde kod, kalın, eğik ve üstü çizili metin desteklenir. Mutlak `http`, `https` ve `mailto` bağlantıları tıklanabilir; göreli, `javascript:` veya `data:` adresleri düz metin olarak kalır.

## Güvenlik

Model çıktısı güvenilmeyen girdidir. Renderer hiçbir aşamada HTML string'ini DOM'a yerleştirmez. Elemanlar `createElement`, metinler `textContent` ile oluşturulur. Bağlantılar allowlist ile sınırlandırılır ve yeni sekmede `noopener noreferrer nofollow` kullanır.

Renderer `localStorage`, cookie, Authorization, Bearer token veya `/api/` erişimine sahip değildir. Bu nedenle sohbet metadata'sı veya kimlik bilgileri üzerinden yeni bir yetki yolu oluşturmaz.

## Sınırlar

Giriş 64 KiB ile, blok sayısı 350 ile, liste öğeleri 240 ile, tablo 120 satır ve 16 sütun ile sınırlıdır. Satır içi biçimlendirme 4 KiB'yi aşan bir satırda düz metne düşer. Kod blokları en fazla 2000 satır işler.

Bu sınırlar streaming yeniden çizimlerinde kötü niyetli veya aşırı büyük model çıktısının ana thread'i sınırsız meşgul etmesini önlemek içindir.

## Kopyalama

Kod bloğunun başlığındaki `Kopyala` düğmesi Clipboard API varsa yalnız kodun ham metnini kopyalar. Başarılı kopyalamada düğme kısa süre `Kopyalandı` durumuna geçer. Clipboard kullanılamıyorsa sessizce başarısız olur; model yanıtı değişmez.

## Entegrasyon

`public/chat-markdown.js` bir `MutationObserver` ile `#messages` alanını izler. Böylece mevcut `app.js` streaming, edit ve retry akışlarını yeniden yazmak gerekmez. Yalnız `.message.assistant .content` düğümleri biçimlendirilir; kullanıcı mesajları verbatim kalır.

PWA shell listesine JS/CSS eklenir ve her shell sürüm değişikliğinde service worker cache revision artırılır.
