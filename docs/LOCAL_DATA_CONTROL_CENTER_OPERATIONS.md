# Yerel Veri Merkezi — Operasyon

## Normal durum

Panel mevcut yönetilen alanları listeler ve toplam byte kullanımını yaklaşık gösterir. Bir alan yoksa `Kayıt yok` ifadesi normaldir.

## Storage exception

`localStorage` okunamıyorsa inspector exception'ı yutar ve UI'nin kalanını çalışır bırakır. Bu durumda kullanıcıya veri erişilemediği bildirilmelidir; sahte bir temizleme başarı mesajı verilmez.

## Çok büyük kayıt

1.5 MB okuma sınırı aşılırsa kayıt `truncated` olarak işaretlenir. Yapısal sayım yapılmaz. Kullanıcı verisi daha fazla okunmaz.

## Toplu temizleme

Temizleme yalnız bilinen key'ler üzerinden yürür. Sonuç kısmi ise UI `bazı veriler temizlenemedi` durumunu gösterir.

## Cross-tab

Başka sekmede storage değişirse veri merkezi `storage` event'i ile özetini yeniler. Event'te `key:null` gelmesi tam storage temizliği anlamına gelebilir ve yeni snapshot alınır.

## Manifest

Manifest indirimi kullanıcı tarafından başlatılır. Blob URL kısa süre içinde revoke edilir. Manifest metadata-only olduğundan operasyon sırasında içerik backup'ı olarak kullanılmamalıdır.

## PWA deployment

Yeni CSS/JS dosyaları shell cache'e eklenir ve cache version artırılır. `/api/*` davranışı değiştirilmez.

## Monitoring

Bu client-side feature server log veya telemetry üretmez. Operasyon gözlemi kullanıcı tarafından indirilen manifest ve tarayıcı davranışı üzerinden yapılabilir.

## Rollback sinyali

Çekirdek sohbet, composer veya settings açılmazsa data center script'i fail-closed şekilde mount olmamalıdır. Uygulamanın ana chat akışı önceliklidir.
