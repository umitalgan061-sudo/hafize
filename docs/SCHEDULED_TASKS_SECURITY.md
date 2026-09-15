# Zamanlanmış Görevler — Güvenlik Modeli

## Güvenlik hedefi

Schedule UI, mevcut server-side scheduler'ı güvenli bir kullanıcı yüzeyi haline getirir. İstemci hiçbir server secret'ı öğrenmez ve yürütme yetkisini kendi başına genişletemez.

## Kimlik doğrulama

Schedule HTTP API authenticated principal ister.

401 yanıtı UI'da oturum gereksinimi olarak gösterilir.

Tarayıcı tarafındaki kod `HAFIZE_SCHEDULE_AUTH_TOKEN`, NVIDIA anahtarı veya başka server secret'ları okumaz.

İstemci same-origin credentials kullanır.

## Yetkilendirme

List komutu principal ile scope edilir.

Cancel komutu önce kayıt sahibini doğrular.

UI, schedule ID'yi kullanıcı yetkisinin kanıtı olarak kabul etmez.

Başka bir kullanıcının ID'si elle girilse bile server ownership kontrolü uygulanır.

## Görev metni

Görev metni backend'e gönderilir çünkü server-side worker'ın yürütmesi gereken asıl talep budur.

Command boundary plaintext credential politikasını uygular.

UI ek güvenlik filtresiymiş gibi davranmaz; server validation son otoritedir.

## DOM güvenliği

Kullanıcıdan veya server response'undan gelen task text DOM'a `textContent` ile yazılır.

`innerHTML`, `outerHTML`, `eval` veya `new Function` kullanılmaz.

Trace ID sınırlı attribute/value ile gösterilir.

## URL güvenliği

Schedule ID DELETE path'inde `encodeURIComponent` kullanılır.

Kullanıcı input'u route path'ine doğrudan birleştirilmez.

## Request güvenliği

Client request body yalnızca backend tarafından desteklenen alanları içerir.

`credentials: same-origin` ile browser session kullanılır.

`Accept: application/json` beklenir.

Response JSON olmayan hatalarda generic hata gösterilir.

## CSRF

Uygulamanın state-changing API koruması server-side katmanda kalır.

UI cookie tabanlı session'ı API'ye bağlar.

Client yeni bir CSRF mekanizması tanımlamaz ve mevcut production guard kurallarını bypass etmez.

## Retry güvenliği

UI kendi retry scheduler'ını yaratmaz.

Polling GET'tir.

POST yalnızca kullanıcı form submit'iyle başlar.

DELETE yalnızca kullanıcı onayından sonra çalışır.

## Polling

Panel açıkken refresh interval'i aktiftir.

Panel kapatıldığında timer temizlenir.

Kapanış sırasında pending request varsa AbortController mümkün olduğunda iptal edilir.

UI shell cache'den schedule API cevabı sunulmaz.

## Secret taşıma

Schedule auth token HTML'e gömülmez.

Token localStorage veya sessionStorage'a yazılmaz.

Görevler modülünün CSS/HTML dosyalarında credential bulunmaz.

## Data minimization

Liste response'u ownerId içermediği için UI'ya taşınmaz.

UI yalnızca kullanıcı deneyimi için gereken task, agent, status, attempts, timestamps, error ve trace metadata'sını işler.

## Hata ayrıştırma

401 authentication problemidir.

400 input/agent problemidir.

404 schedule bulunamadığını gösterir.

409 schedule state iptale izin vermiyordur.

503 scheduler kapasite sınırına ulaşmıştır.

Client bu sınıfları generic tek hata yerine mümkün olduğunca ayırır.

## Clickjacking ve frame güvenliği

Uygulamanın mevcut response security headers'ı korunur.

Yeni UI ayrı bir iframe veya cross-origin embed mekanizması eklemez.

## Offline davranış

UI asset'i offline olabilir; schedule verisinin kendisi cache'lenmez.

Offline durumda API isteği başarısız olur ve kullanıcıya servis erişimi hatası gösterilir.

Bu davranış eski schedule state'inin yanlışlıkla yeni state gibi sunulmasını engeller.

## Threat model

### Kötü niyetli kullanıcı

Kullanıcı DOM manipülasyonu veya manuel request ile kendi yetkisini aşmaya çalışabilir.

Savunma: backend auth ve ownership.

### Zararlı task text

Task text script benzeri içerik taşıyabilir.

Savunma: credential policy + güvenli DOM rendering + server-side execution boundary.

### Çok büyük input

20.000 karakter üstü task body request'i zorlayabilir.

Savunma: command boundary ve HTTP body limitleri.

### Çok fazla schedule

Kullanıcı kapasiteyi doldurabilir.

Savunma: bounded store ve 503 capacity response.

### Yarışan iptal

Task running hale gelirken kullanıcı cancel gönderebilir.

Savunma: backend state transition kontrolü; UI 409 sonucunu anlamlı gösterir.

### Eski PWA cache

Eski client schedule UI'yi servis edebilir.

Savunma: cache version bump ve static asset shell listesi.

## Güvenlik kabul kriterleri

Secret'lar istemci bundle'ına girmemeli.

API GET/POST/DELETE same-origin olmalı.

DELETE path'i encode edilmeli.

Task text güvenli DOM API'leriyle render edilmeli.

API responses ownerId sızdırmamalı.

Schedule API `/api/` olduğu için service worker shell cache'de olmamalı.

## Olay günlüğü

Bu UI yeni analytics telemetry eklemez.

Server worker'ın kendi execution/trace gözlem mekanizması varsa mevcut runtime kullanılır.

Client yalnızca kullanıcıya status gösterir.
