# Prompt Library Kararları

## ADR-01: localStorage

Prompt Library ilk sürümde yalnız localStorage kullanır.

Nedeni: hızlı erişim, offline çalışma, connector yüzeyini büyütmeme ve secret/credential riskini azaltmadır.

Sunucu senkronizasyonu ileride eklenirse ayrı bir özellik ve ayrı yetki modeli olmalıdır.

## ADR-02: ayrı storage key

Conversation history ile ortak JSON kullanmak yerine prompt verisi ayrı anahtardadır.

Böylece `app.js` save işlemleri prompt metadata'yı ezemez.

## ADR-03: değişkenler metin yerleştirme

İlk sürüm prompt değişkenlerini basit `{{name}}` tokenları olarak ele alır.

Şablon dili veya JavaScript değerlendirmesi yoktur.

Bu tercih güvenlik ve öngörülebilirlik içindir.

## ADR-04: otomatik gönderim yok

`Kullan` yalnız composer textarea'sını doldurur.

Gönderim kullanıcı tarafından açıkça yapılır.

Bu, yanlış veya eksik değişkenlerin kontrol edilmesini sağlar.

## ADR-05: import overwrite yok

Import aynı id'yi bulduğunda mevcut kaydı güncellemek yerine yeni id üretir.

Böylece kullanıcı kendi isteminin üstüne dış dosya yazılmasına karşı korunur.

## ADR-06: normalize on read

Storage dışındaki veri güvenilmez kabul edilir.

Her okuma sonrasında kayıtlar tekrar normalize edilir.

Bu, eski veya elle değiştirilmiş localStorage değerlerinin UI'yi bozmasını önler.

## ADR-07: bounded UI

Liste ve editor boyutları hard limitlidir.

Amaç büyük localStorage payload'larının tarayıcı arayüzünü kilitlemesini önlemektir.

## ADR-08: static skeleton

Kart iskeleti sabit markup ile oluşturulabilir; prompt verisi string olarak markup'a birleştirilmez.

Dinamik başlık, tag, preview ve status değerleri DOM API ile set edilir.

## ADR-09: enhancement module

Kopyalama, çoğaltma ve bulk helper'lar core modülden ayrı tutulur.

Bu, temel CRUD davranışının test edilmesini kolaylaştırır ve feature büyüdüğünde tek dosyanın aşırı büyümesini önler.

## ADR-10: PWA shell

Prompt library offline shell'in parçasıdır.

API veya dış ağ erişimi yine service worker'da network-only kalır.
