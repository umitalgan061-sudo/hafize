# Gizlilik Merkezi QA Planı

## Functional

Inventory bilinen anahtarları sınıflandırmalı, prefix alanları yakalamalı ve bilinmeyenleri sayaç olarak bırakmalıdır.

Tek alan silme yalnız hedef anahtarları kaldırmalı. Data grubu temizliği preference alanlarını bırakmalıdır. Full cleanup bilinmeyen anahtarları bırakmalıdır.

## Reporting

Rapor JSON parse edilebilir olmalı, localOnly true ve contentIncluded false içermelidir. Prompt veya message raw değerlerinin rapor metninde bulunmaması gerekir.

## Accessibility

Panel başlığı, collapse ilişkisi, status/live bölgesi ve temizleme aria-label'ları korunmalıdır. Kısayol input alanında çalışmamalıdır.

## Security

Kaynakta fetch/XHR/WebSocket ve global storage clear kullanımı olmamalıdır. Dinamik metin textContent ile kurulmalıdır.

## PWA

CSS ve JS asset path'leri index ve sw-policy'de bulunmalıdır. Cache sürümü değiştiğinde eski cache temizleme davranışı korunmalıdır.

## Failure cases

localStorage erişimi yok, navigator.storage.estimate yok, clipboard yok, Blob oluşturulamıyor ve removeItem hata veriyor senaryoları kullanıcıya güvenli hata göstermelidir.

## Acceptance

Fonksiyonel testler ve syntax smoke geçmeden PR merge edilmez.
