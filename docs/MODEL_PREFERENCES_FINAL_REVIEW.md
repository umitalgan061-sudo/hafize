# Model ve Ajan Tercihleri Final Review

## Ürün

Son model ve ajan seçimi yerelde hatırlanıyor.
Profil kaydetme, uygulama, adlandırma, çoğaltma ve silme var.
JSON import ve export var.
Import önizleme ve açık onay var.

## Güvenlik

Yeni backend endpoint yok.
Credential saklama alanı yok.
Import boyutla sınırlı.
ID collision overwrite yapmıyor.
Profil apply submit yapmıyor.
Export object URL revoke ediliyor.

## Erişilebilirlik

Dialog semantics mevcut.
Escape mevcut.
Tab trap mevcut.
Focus restoration mevcut.
Klavye kısayolu form alanlarında guard edilir.
Responsive, reduced-motion ve forced-colors stilleri mevcut.

## PWA

CSS shell asset olarak cache edilir.
Cache version v45'e taşındı.
API yolları network-only kalır.

## Test

Typed unit test.
Source contracts.
Security.
Accessibility.
Lifecycle.
Import/export.
PWA.
Selection restore.
Profile actions.
Import preview.
Cross-tab.
