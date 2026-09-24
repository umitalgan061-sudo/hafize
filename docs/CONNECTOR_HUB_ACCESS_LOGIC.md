# Bağlantılar erişim mantığı

## Genel kural

UI bir connector'ın write iznine sahip değildir.

## GitHub

Read readiness:

githubReadConfigured true olduğunda Hazır.

False olduğunda Kapalı.

## Gmail

Configuration ve link iki ayrı kavramdır.

Configuration true olup linked false olabilir.

## Canva

Configuration ve link iki ayrı kavramdır.

Configuration true olup linked false olabilir.

## Oturum

Status endpoint AUTH_REQUIRED döndürdüğünde UI bunu bağlantı eksikliği olarak yorumlamaz; oturum gerekir mesajını kullanır.

## Unknown

Bilinmeyen error kodları genel okunamıyor yoluna gider.

## Capability

Capability listesi UI açıklamasıdır.

Authoritative permission server policy'dir.

## Mutation

Hub hiçbir connector permission state'ini değiştiremez.
