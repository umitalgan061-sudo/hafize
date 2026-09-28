# Recurrence Güvenlik

## Saldırı yüzeyi
POST /api/schedules recurrence alanı
Şifreli schedule snapshot'ı
Browser recurrence formu
Yerel preset import/export

## Input validation
Unknown recurrence fields reddedilir.
frequency allowlist ile sınırlandırılır.
interval bounded integer'dır.
weekly günleri 0–6 aralığına indirgenir.
monthly günleri 1–31 ile sınırlanır.

## Credential policy
Görev metni mevcut plaintext credential politikasından geçer.
Recurrence alanı credential policy kapsamına girecek serbest metin kabul etmez.
History yalnız kontrollü hata kodu taşır.

## Storage isolation
Preset storage schedule API storage'ından ayrıdır.
Browser schedule response service worker cache'lenmez.
Local preset yedekleri yalnız kullanıcının cihazında tutulur.

## DOM
UI text düğümleri textContent ile oluşturulur.
Kullanıcı task metni HTML olarak birleştirilmez.
History satırlarında güvenilmeyen değerler DOM attribute yerine bounded text olarak gösterilir.

## Authorization
Recurring schedule oluşturma mevcut authenticated owner sınırını kullanır.
List yalnız principal owner kayıtlarını döndürür.
Cancel owner kontrolünü değiştirmez.

## Threat response
Malicious import bounded şekilde reddedilir.
Malformed recurrence 400 seviyesinde normalize edilir.
Aşırı geçmiş verisi 20 kayıtla kesilir.

## DoD
Credential-bearing task, malformed recurrence, oversized import,
unknown field, cross-owner cancel ve DOM injection testleri geçmelidir.
