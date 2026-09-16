# Platform Runtime Tasks

## Amaç

Task queue, kısa ömürlü tarayıcı işleri için bounded concurrency sağlar. Ağır veya uzun backend işleri bu queue'nun kapsamı değildir.

## Öncelik

`critical`, `normal`, `idle` sırasıyla yürütülür. Aynı öncelikte FIFO yaklaşımı korunur.

## Güvenlik

Queue sınırsız büyümez. Varsayılan maksimum 32 kayıt ve concurrency 2'dir. Timeout 250 ms ile 120 saniye arasında normalize edilir.

## Cancel

`AbortSignal` task'a geçirilir. Kullanıcı veya feature stop çağrısı abort reason taşır. Task'ın kendi işi signal değişimini takip etmelidir.

## Timeout

Timeout task controller'ını abort eder. İş abort'a uygun değilse network/CPU işlemi kendi yaşam döngüsünü ayrıca kapatmalıdır.

## Hata izolasyonu

Bir task fail olduğunda queue pump devam eder. Başka task'ların başlatılması engellenmez.

## Prune

Tamamlanmış, failed ve cancelled task'ların eski kayıtları `prune()` ile kaldırılır.

## Snapshot

Queue snapshot'ı yalnızca metadata içerir: id, priority, state, timestamps ve hata özeti. Closure veya payload açığa çıkarılmaz.

## Kullanım örnekleri

- görünür panel açılınca hafif render bakımı,
- offline geldiğinde local index refresh,
- diagnostics JSON hazırlama,
- düşük öncelikli UI ölçüm temizliği.

## Kullanılmaması gereken işler

- sonsuz döngüler,
- kullanıcı credential işlemleri,
- büyük dosya transformları,
- uzun ömürlü websocket bağlantıları,
- kullanıcı onayı isteyen dış servis yazmaları.
