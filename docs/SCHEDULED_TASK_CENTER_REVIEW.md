# Görev Merkezi Review

## Kullanıcı akışı

Form hazırlama, şablon, hızlı zaman, yerel taslak, preview, onay ve görev listesi tek akışta kalır.

## Veri

Preview, template, draft ve export katmanlarının her biri farklı sorumluluk taşır. Server state yalnız mevcut schedule workspace üzerinden değiştirilir.

## Güvenlik

Yeni yardımcı modüller doğrudan fetch yapmaz. Preview yalnız submit kapısıdır; duplicate ve template uygulama da POST başlatmaz.

## PWA

Tüm yeni JS/CSS assetleri service worker shell listesinde tutulur ve cache version artırılır.

## Rollback

UI asset bağlantıları kaldırılabilir; backend migration gerekmez.
