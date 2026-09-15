# Markdown güvenlik inceleme kontrolü

## Input

Model çıktısı güvenilmez kabul edilir.

Null byte temizlenir.

Input 24.000 karakterle sınırlandırılır.

Blok ve satır sınırları CPU/DOM yükünü bounded tutar.

## HTML

Renderer HTML string üretmez.

DOM düğümleri açıkça oluşturulur.

`textContent` model metni için temel aktarım kanalıdır.

## URL

Yalnız `http`, `https`, `mailto` izinlidir.

`javascript`, `data`, `vbscript` ve diğer şemalar reddedilir.

Harici linklerde `noopener noreferrer` kullanılır.

## Code

Kod blokları execute edilmez.

`eval`, `Function` veya sandbox runner yoktur.

Copy yalnız text aktarımıdır.

## Download

Download Blob client-side oluşturulur.

Server upload endpoint'i çağrılmaz.

Object URL revoke edilir.

## Quote

Alıntılama yalnız composer değerini günceller.

HTML parse edilmez.

Composer maxlength korunur.

## Outline

Heading label'ları `textContent` ile üretilir.

Heading id'leri local DOM navigation içindir.

## Preference

Display preference sadece `on/off` değeri saklar.

Conversation data içine yazılmaz.

## Observer

Observer yalnız `#messages` ağacını izler.

Sonsuz retry veya interval bulunmaz.

## PWA

Yeni assetler shell cache'tedir.

API yolları network-only kalır.

## Review sign-off

Her yeni syntax veya HTML elementinden önce bu belge ve testleri güncellenmelidir.

Güvenlik regresyonu release blocker'dır.
