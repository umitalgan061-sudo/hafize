# Health Center Tarayıcı Matrisi

## Chromium tabanlı masaüstü

Local storage, Blob, URL ve native form kontrolleri desteklenmelidir.

Panel desktop genişliğinde altı metrikli grid kullanır.

## Chromium mobil

700px breakpoint sonrası aksiyonlar iki kolona iner.

Sorun listesi dikey kaydırılır.

## Safari

Storage erişim hataları catch bloklarıyla ele alınır.

Clipboard bulunamazsa panel rapor kopyalama yerine kullanıcıya hata durumu gösterir.

## Firefox

Unicode tokenization ve Turkish locale işlemleri standart Intl/RegExp API'leri kullanır.

## PWA

Health CSS/JS shell cache'te bulunmalıdır.

Service worker API yollarını network-only bırakır.

## Erişilebilirlik

Keyboard-only kullanım native form öğeleri sayesinde korunur.

Forced-colors görünümü ayrıca kontrol edilir.

## Degradation

Health paneli mount olmazsa sohbet ve Prompt Library çekirdeği kullanılmaya devam eder.

Clipboard, Blob veya storage desteklenmeyen durumlar yalnızca ilgili özelliği etkiler.

## Manuel kontrol

Masaüstünde filtre, yeniden tarama, onarım ve export düğmeleri denenir.

Mobilde yatay taşma ve issue listesi kaydırması denenir.
