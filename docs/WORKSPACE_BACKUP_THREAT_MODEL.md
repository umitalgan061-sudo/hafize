# Çalışma Alanı Yedeği Tehdit Modeli

## Varlıklar

Yerel sohbet geçmişi kullanıcı verisidir.

Prompt library içeriği kullanıcı verisidir.

Message workspace notları kullanıcı verisidir.

Model preference profilleri tercih verisidir.

Composer history kullanıcı girdileridir.

Task templates kullanıcı çalışma biçimini yansıtır.

Smart Fill değerleri kullanıcı tarafından girilmiş bağlam olabilir.

Backup dosyası bu varlıkların seçilen birleşimidir.

## Güven sınırları

Browser localStorage güvenilmeyen girdilerin depolanabildiği bir alandır.

Download klasörü uygulamanın kontrolünde değildir.

Import dosyası tamamen dışarıdan gelen girdidir.

Service worker cache yalnız uygulama shell'i için kullanılır.

Backend runtime backup modülünün veri deposu değildir.

## Saldırgan modeli

Saldırgan bozuk bir backup dosyası üretebilir.

Saldırgan unknown storage key ekleyebilir.

Saldırgan sensitive-looking key ekleyebilir.

Saldırgan çok büyük payload üretebilir.

Saldırgan digest'i değiştirebilir.

Saldırgan DOM içine markup taşıyabilir.

Saldırgan Smart Fill suffix'ini kötüye kullanabilir.

## Kontroller

Allowlist bilinmeyen storage key'leri engeller.

Sensitive key denylist ikinci sınırı sağlar.

Byte limits memory tüketimini sınırlar.

Section count sınırı parser yükünü sınırlar.

Integrity digest dosya değişikliklerini algılar.

textContent DOM injection riskini azaltır.

Confirmation destructive write'ı kullanıcı iradesine bağlar.

Rollback state bozulması riskini azaltır.

## Yetki

Backup modülü credential okuyamaz.

Backup modülü network write yapamaz.

Backup modülü server task state'i okuyamaz.

Backup modülü session state'i export edemez.

Backup modülü OAuth token export edemez.

## Data exfiltration

Export kullanıcı tarafından tetiklenir.

Download local browser API'si üzerinden gerçekleşir.

Remote telemetry yoktur.

Remote analytics yoktur.

Remote backup yoktur.

## Integrity tehditleri

Dosyanın section data'sı değiştirilebilir.

Digest mismatch bu değişikliği yakalar.

Hash algoritması SHA-256'dır.

Kanonik serialization hash girdisini sabitler.

## Restore tehditleri

Malicious backup mevcut state'in üzerine yazmaya çalışabilir.

Preview ve confirmation bu riski iki aşamaya böler.

User-selected section listesi blast radius'u azaltır.

Capture and rollback hata etkisini azaltır.

## Availability

Büyük dosya parsing'i engellenir.

Section size cap kullanılır.

Smart Fill dynamic entry cap kullanılır.

Storage failure catch edilir.

UI timer ve observer cleanup sağlar.

## Audit

Backup metadata export zamanını saklar.

Metadata gerçek içerik saklamaz.

No server audit record oluşturulmaz.

Kullanıcı download dosyasını kendi saklar.

## Residual risk

localStorage güvenlik sınırı browser origin modeline bağlıdır.

Backup dosyası kullanıcıya ait dış bir artefakttır.

Kullanıcı dosyayı paylaşırsa içeriği ifşa olabilir.

Rollback browser storage davranışına bağlıdır.

Bu residual riskler kullanıcı rehberinde açıkça belirtilir.

## Review soruları

Yeni section güvenli mi.

Yeni storage key allowlist'te mi.

Yeni dynamic key regex'e uyuyor mu.

Yeni UI alanı textContent kullanıyor mu.

Yeni write confirmation gerektiriyor mu.

Yeni failure path rollback içeriyor mu.

Yeni PWA asset'i cache ile hizalı mı.

## Sonuç

Tehdit modeli privilege minimization, allowlist, bounded parsing, integrity ve confirmation katmanlarına dayanır.

Feature mevcut uygulamanın server-side auth sınırlarını genişletmez.

