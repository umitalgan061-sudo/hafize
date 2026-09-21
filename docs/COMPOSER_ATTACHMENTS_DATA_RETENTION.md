# Composer Ekleri — Data Retention

## Staged data
Bekleyen attachment içeriği yalnız browser memory'de tutulur.

## Expiry
Bekleyen queue 15 dakika içinde temizlenir.

## Page close
Sayfa kapandığında in-memory queue kaybolur.

## Sent data
Kullanıcı açıkça composer'a ekleyip normal chat gönderirse gönderilen metin conversation history'nin normal mesajı olabilir.

## Unsent data
Mesaja hiç eklenmemiş veya gönderilmemiş attachment content kalıcı storage'a aktarılmaz.

## Clipboard
Kopyalama eylemi browser clipboard lifetime'ına tabidir; uygulama clipboard history tutmaz.

## Support
Retention soruşturmasında dosya içeriği istemek yerine storage key ve runtime state incelemesi yapılır.