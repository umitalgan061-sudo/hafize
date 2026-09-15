# Markdown uyumluluk notları

## Tarayıcı API'leri

Renderer modern DOM API'leri kullanır.

Gerekli temel yüzey `document.createElement`, `createTextNode`, `replaceChildren`, `MutationObserver` ve standart URL API'sidir.

`crypto` veya özel browser extension API'lerine bağımlılık yoktur.

## Clipboard

Kod kopyalama Clipboard API kullanılabilir olduğunda etkinleşir.

API yoksa düğme hata mesajı verir; mesaj görüntüleme devam eder.

## Legacy tarayıcılar

Polyfill paketi eklenmez.

Desteklenmeyen browser'da script yüklenmezse ana sohbet plain text olarak çalışmaya devam eder.

## PWA

Markdown assetleri shell cache'e eklenir.

Cache versiyonu değiştirildiğinde eski shell cache policy tarafından temizlenir.

## Tema

Renderer mevcut design tokenlarını kullanır.

Koyu ve açık temada ayrı renk kodlaması yapılmaz.

## Mobil

Kod blokları overflow alanında kalır.

Linkler satır içinde kırılabilir.

Toolbar dar ekranda küçültülür.

## Veri uyumluluğu

Storage şeması değişmez.

Markdown yalnızca render katmanıdır.

Conversation export mevcut ham mesaj verisini korur.

## Feature fallback

Renderer yüklenmezse `app.js` tarafından oluşturulan `.content` düğümü plain text kalır.

Renderer enhancement yüklenmezse kullanıcı yanıtı kaybetmez.

## Ağ davranışı

Yeni endpoint yoktur.

Dynamic asset loader yalnız aynı origin içindeki sabit public path'leri yükler.

API istekleri Markdown katmanından başlatılmaz.
