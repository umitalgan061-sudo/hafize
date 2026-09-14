# Prompt Library Compatibility

## Tarayıcı

Feature modern browser DOM APIs kullanan mevcut Hafize shell'iyle uyumludur.

`crypto.randomUUID` bulunmazsa fallback id üretimi vardır.

Clipboard API bulunmazsa kopyalama işlemi status ile sonlanır.

FileReader ve Blob API yoksa import/export eylemleri güvenli biçimde başarısız olur.

## PWA

Service worker shell cache'de prompt asset'leri bulunur.

Cache version değişikliği eski shell sürümlerinin temizlenmesiyle mevcut policy'ye bağlıdır.

## Storage

Bozuk JSON değeri crash sebebi değildir.

Unknown kayıt alanları normalize sonucuna taşınmaz.

Eski state içindeki bilinmeyen sort default'a döner.

## Mobil

700px altındaki görünümde toolbar tek kolona düşer.

Liste kendi max-height/overflow alanında kalır.

Butonlar sıkıştırılsa dahi metin taşması `overflow-wrap` ile kırılır.

## Tema

Prompt library mevcut `--text`, `--muted`, `--panel`, `--card`, `--line`, `--accent` token'larını kullanır.

Açık ve koyu tema için yeni sabit renk sistemi eklenmez.

## Erişilebilirlik

Arama, sıralama, etiket ve favori filtreleri erişilebilir etiket taşır.

Dinamik durum mesajları `role=status` ve `aria-live=polite` ile bildirilir.

Keyboard focus outline görünür tutulur.

Forced colors modunda border ve focus sistem renklerine uyarlanır.

## Kapsam sınırı

Eski tarayıcılara polyfill paketi eklenmez.

Bu sürüm server-side persistence veya cloud sync sağlamaz.
