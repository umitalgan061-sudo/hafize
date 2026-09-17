# Health Center Migration

## İlk kurulum

Health center mevcut `hafize.prompt-library.v1` kayıtlarını değiştirmeden okuyabilir.

Yeni bir veri migrasyonu zorunlu değildir.

Panel state için `hafize.prompt-library.health.v1` anahtarı gerektiğinde otomatik oluşturulur.

## Eski kayıtlar

Eski prompt kayıtları mevcut normalizer ile tanınabiliyorsa rapora dahil edilir.

Tanı işlemi başarısız kayıtları sessizce geçerli saymaz; hata üretir.

## Collections

Collection storage mevcutsa prompt id referansları kontrol edilir.

Eksik collection storage boş kabul edilir.

## Revisions

Revision storage mevcutsa prompt id ilişkileri kontrol edilir.

Eksik revision storage normal durumdur.

## Smart Fill

Smart Fill presetleri ayrı namespace'te tutulduğu için migration sırasında değiştirilmez.

## Rollout

Önce statik asset'ler deploy edilir, ardından panel görünür hale gelir.

Service worker cache sürümü yükseltilir.

## Rollback

Health asset'leri geri alınabilir; ana prompt formatı değişmediği için ikinci bir migration gerekmez.

## Veri koruma

Kullanıcı prompt export alarak migration öncesi yedek oluşturabilir.
