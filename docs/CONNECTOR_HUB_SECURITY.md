# Bağlantılar güvenlik modeli

## Tehditler

Connector hub aşağıdaki risklere karşı tasarlanır:

- credential sızıntısı
- cross-origin çağrı
- yanlışlıkla write isteği
- stale session verisi
- DOM injection
- provider hata detaylarının sızması
- sonsuz refresh döngüsü
- browser storage'a token yazılması

## Client-side sınır

UI yalnız mevcut authenticated API'leri çağırır. GitHub token'ı veya OAuth tokenı tarayıcıya taşınmaz.

## Method sınırı

Tüm hub network çağrıları explicit GET kullanır. POST, PUT, PATCH ve DELETE çağrısı bulunmaz.

## Origin sınırı

credentials: same-origin kullanılır. Mutlak üçüncü taraf authorization URL'si üretilmez.

## Storage sınırı

Session state yalnız hafize.connector-hub.v1 anahtarında tutulur. Provider response payload'ları sessionStorage veya localStorage'a yazılmaz.

## DOM sınırı

Dinamik provider ve hata metinleri textContent ile oluşturulur. Kullanıcı/provider verisi innerHTML veya outerHTML ile yerleştirilmez.

## Write sınırı

GitHub kartı özellikle salt-okunur hazır olma durumunu gösterir. Branch, commit ve merge eylemi eklenmez.

## OAuth sınırı

OAuth başlatma, callback ve token exchange server runtime'ında kalır. Hub bunlara erişim sağlamaz.

## Hata sınırı

AUTH_REQUIRED, TIMEOUT ve NETWORK_ERROR gibi kodlar yeterli ayrıntı sağlar. Raw exception mesajı gösterılmaz.

## Lifecycle sınırı

destroy sonrasında refresh sonucu UI'a yazılmaz. Event listener'lar kaldırılır.

## Abuse kontrolü

Refresh cooldown ve in-flight guard istek patlamasını sınırlar.

## Güvenlik DoD

- client credential içermez
- write method içermez
- cross-origin fetch içermez
- secret DOM'a yazılmaz
- response payload kalıcı depolanmaz
- destroy sonrası mutation oluşmaz
