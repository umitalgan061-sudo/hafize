# Tarayıcı Uyumluluk Matrisi

## Temel

localStorage, DOM createElement, textContent, Blob ve URL.createObjectURL modern tarayıcı hedefinin parçasıdır.

## Geliştirme

navigator.storage.estimate ve Clipboard API opsiyoneldir.

Estimate yoksa kota kartı bilinmiyor gösterir.

Clipboard yoksa copy işlemi hata durumuna düşer; başka transport kullanılmaz.

## PWA

Service Worker shell cache asset'leri aynı-origin olarak yüklenir. /api isteği cache yolundan geçmez.

## Mobile

680px altında özet üçlü kartı tek sütuna iner ve işlem düğmeleri tam genişliğe çıkar.
