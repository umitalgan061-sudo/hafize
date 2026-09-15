# Markdown PR summary

## Ana iyileştirme

Hafize assistant yanıtları için güvenli, bağımlılıksız Markdown sunumu.

## Kullanıcıya etkisi

Başlık, liste, görev listesi, tablo, alıntı, code block ve bağlantılar daha okunabilir olur.

Assistant mesajlarına Kopyala, İndir, Alıntıla ve Ham metin kontrolleri gelir.

Uzun yanıt ve kod alanları daraltılabilir.

Çok başlıklı yanıtlar için başlık özeti sunulur.

Markdown biçimlendirmesi cihaz üzerinde açılıp kapatılabilir.

## Veri modeli

Conversation storage değişmez.

Renderer geçici DOM oluşturur.

Yeni tercih ayrı localStorage anahtarındadır.

## PWA

Yeni assetler shell cache'e eklenir.

## Test

Syntax, source, security, formatting, streaming, links, limits, DOM, fallback, PWA, accessibility, actions, outline ve preference kontrolleri bulunur.

Runtime testi hafif DOM ile gerçek renderer export'unu çalıştırır.

## Operasyon

Runbook, support, rollback, migration, failure modes, benchmark ve release belgeleri eklenmiştir.

## Kabul

3000 değişen satır sınırı aşılmaz.

Güvenlik ve fallback davranışı regresyona uğramaz.
