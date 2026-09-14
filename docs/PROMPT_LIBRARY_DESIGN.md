# Prompt Library UX Tasarım Notları

## Hiyerarşi

Kart başlığı ve kayıt sayısı ilk bakışta görünür.

Arama ve sıralama en üstte tutulur çünkü en sık kullanılan keşif eylemleridir.

Etiket/favori filtreleri ikinci satırdadır.

Kayıt eylemleri her prompt'un altında gruplanır.

## Yoğunluk

Utility rail dar olduğu için kayıt preview'si kısa tutulur.

Uzun prompt için tam metin yalnız editor/composer alanında görülür.

120 kaydın tamamı için sınırsız sayfa yüksekliği kullanılmaz.

## Renk

Yeni sabit palette oluşturulmaz.

Mevcut Hafize design token'ları kullanılır.

Favori state'i yalnız metin/outline değişimiyle anlaşılır; renk tek başına anlam taşımaz.

## Klavye

Arama ve yeni istem kısayolları `Ctrl/⌘+Shift` ailesindedir.

Klavye ile focus görünürdür.

## Mobil

Toolbar tek kolona düşer.

Action butonları satır içinde kırılabilir.

Prompt body preview'si yatay taşma üretmemelidir.

## Durum mesajları

Import, export, save, duplicate ve delete eylemleri kısa status mesajları üretir.

Status alanı `aria-live=polite` taşır.

## Hata deneyimi

Storage hatası kullanıcıyı uygulamadan dışarı atmaz.

Clipboard eksikliği feature'ı tamamen devre dışı bırakmaz.

Geçersiz import mevcut kayıtları etkilemez.

## Tasarım ilkesi

Prompt Library sohbeti domine eden ikinci bir uygulama gibi görünmemelidir.

Yardımcı araç rolünde kalmalı, kullanıcının asıl hedefi olan sohbet girişini hızlandırmalıdır.
