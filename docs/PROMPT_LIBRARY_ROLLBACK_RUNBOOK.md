# Prompt Library Rollback Runbook

Rollback hedefi yeni trust yüzeylerini geri almak, kullanıcının mevcut prompt kayıtlarını korumaktır.

## Önce

1. PR başlığını ve merge commitini kaydet.
2. Kullanıcı verisinin tutulduğu `hafize.prompt-library.v1` anahtarına dokunma.
3. Gerekli ise mevcut prompt'ları export et.

## Uygulama

Yeni import preview, diagnostics ve bulk organizer modüllerini kaldıran commit revert edilir. PWA shell asset listesi eski sürüme döner. Temel Prompt Library scriptleri değiştirilmez.

## Sonra

Ana prompt listesi açılmalı, arama çalışmalı, tekli Kullan davranışı korunmalı ve Usage Insights mevcut veriyi okuyabilmelidir.

## Veri temizliği

Rollback sırasında localStorage temizliği otomatik yapılmaz. Yeni profil veya session anahtarları bırakılabilir; bunlar ana prompt kaydının okunmasını etkilemez.

## Kontrol

- uygulama açılır,
- prompt listesi render olur,
- import eski güvenli davranışla çalışır,
- diagnostics yüzeyi görünmez,
- bulk toolbar görünmez,
- PWA cache eski asset listesiyle tutarlı olur.
