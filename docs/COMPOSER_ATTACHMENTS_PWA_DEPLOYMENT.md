# Composer Ekleri — PWA Deployment

## Shell assets
composer-attachments.css, composer-attachments-policy.js, composer-attachments-secret-scan.js ve composer-attachments.js shell listesinde bulunur.

## Cache version
Attachment asset'i eklendiğinde shell cache version v37 olarak yükseltilmiştir.

## API boundary
Service worker /api/ isteklerini network-only bırakır.

## User files
Kullanıcı seçtiği dosya içeriği shell cache'e girmez.

## Offline
Panel ve static policy/runtime assetleri cache'den açılabilir; normal chat backend çağrıları offline değildir.

## Update
Yeni shell version browser'ın stale asset listesi yerine yeni attachment runtime'ını almasını sağlar.