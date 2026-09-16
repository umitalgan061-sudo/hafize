# Prompt Power Release Notes

## Kullanıcıya görünen değişiklikler

Prompt Library artık güvenli import preview, kütüphane sağlık tanısı ve seçili prompt'ları toplu düzenleme akışlarına sahiptir.

Import preview, dosya içeriğini kaydetmeden önce özetler. Kullanıcı; kayıt sayısını, çakışmaları ve kapasiteyi görür. `İçe aktar` açık bir onay adımıdır.

Sağlık tanısı, yerel kayıtların bütünlüğünü kontrol eder. Bozuk kayıt veya yetim collection üyesi varsa panel bunu sayısal olarak bildirir.

Toplu düzenleme; seçili prompt'lara etiket ve favori işlemlerini tek seferde uygular. Mevcut tekli düzenleme ve kullanım akışları korunur.

## Gizlilik

Bu özellikler için backend analytics, telemetry veya remote sync eklenmemiştir. Prompt içeriği cihaz dışına çıkmaz.

## PWA

Yeni statik JS ve CSS asset'leri shell cache politikasıyla sürümlenir. API path'leri network-only olmaya devam eder.

## Geri alma

Yeni trust modülleri revert edilebilir. Prompt storage silinmemelidir.

## Test

Import, diagnostics ve bulk organizer için kaynak sözleşme testleri; sınırlar, dialog semantiği, kullanıcı onayı, storage ve ağ izolasyonunu kontrol eder.

## Sınırlamalar

Bu araçlar merkezi senkronizasyon veya cihazlar arası paylaşım sağlamaz. LocalStorage erişimi tarayıcı politikasına tabidir.

## Kabul

Temel Prompt Library, yeni modüllerden bağımsız çalışmaya devam eder. Trust modüllerinin yüklenememesi sohbet composer'ını kullanılmaz hale getirmemelidir.
