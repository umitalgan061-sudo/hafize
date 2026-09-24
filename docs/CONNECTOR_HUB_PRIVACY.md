# Bağlantılar gizlilik modeli

## Veri minimizasyonu

Hub sadece bağlantının gerekli durumunu gösterir. Mail içerikleri, Canva dosya içerikleri veya GitHub dosya içerikleri bu panel için okunmaz.

## Sunucuya gönderilenler

UI:

- endpoint yolu
- standart GET
- same-origin credential bağlamı

UI provider'a kullanıcı adı, token veya secret göndermez.

## Browser storage

SessionStorage yalnız panelin gizli/açık durumunu taşır. Bu kayıt connector credential içermez.

## Telemetri

Hub analytics, telemetry, remote logging veya üçüncü taraf ölçüm çağrısı eklemez.

## Clipboard

Hub connector yanıtını otomatik panoya kopyalamaz.

## Cache

Connector API yanıtları service worker shell cache'ine alınmaz. Yalnız UI asset'leri precache edilir.

## Oturum

Protected status endpoint'leri mevcut uygulama oturumunu kullanır. Hub ayrı bir authentication state üretmez.

## Bağlantı sahipliği

Gmail ve Canva linked durumu server-side owner principal üzerinden çözülür. Browser bu owner ID'yi bilmez.

## Veri saklama

Hub provider durumunu kalıcı olarak kaydetmez.

## Kullanıcı kontrolü

Kullanıcı paneli açabilir, gizleyebilir ve manuel yenileyebilir. Bir bağlantıyı bu panelden silmek mümkün değildir.

## Gizlilik DoD

- connector response localStorage'a yazılmaz
- sessionStorage yalnız UI state içerir
- mail/dosya içeriği okunmaz
- third-party telemetry yoktur
