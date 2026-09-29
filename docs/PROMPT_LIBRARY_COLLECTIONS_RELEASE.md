# Koleksiyon Release Kontrolü

## Kod

[ ] Collection module syntax kontrol edildi.

[ ] Keyboard module syntax kontrol edildi.

[ ] CSS asset index'e eklendi.

[ ] JS asset index'e eklendi.

[ ] Service worker shell listesi güncellendi.

## Veri

[ ] Collection limit 24.

[ ] Collection name limit 36.

[ ] Import limit 500 KB.

[ ] Assignment map bounded.

[ ] Stale prompt assignment prune ediliyor.

## UX

[ ] Tekli assignment çalışıyor.

[ ] Bulk assignment çalışıyor.

[ ] Filter görünürlüğü çalışıyor.

[ ] Default collection yalnız yeni prompt'lara uygulanıyor.

[ ] Silme prompt verisini koruyor.

## Erişilebilirlik

[ ] aria-label alanları var.

[ ] role=list ve role=listitem kullanılıyor.

[ ] Enter/Escape editor davranışı mevcut.

[ ] Keyboard shortcut editable alanları bozmuyor.

## Güvenlik

[ ] Dinamik adlar textContent ile yazılıyor.

[ ] Import parse hatası catch ediliyor.

[ ] Export URL revoke ediliyor.

[ ] Network request eklenmedi.

## Release ölçümü

Base → head toplam changed lines 3000'i geçmemelidir.

Hedef 2800 civarıdır; yalnızca anlamlı feature, test ve dokümantasyon değişiklikleri kabul edilir.

## Rollback

Collection assetleri geri alınabilir. Prompt Library temel storage'ı korunur.
