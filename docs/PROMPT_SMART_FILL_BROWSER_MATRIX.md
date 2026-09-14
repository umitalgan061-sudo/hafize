# Smart Fill Tarayıcı Uyumluluk Matrisi

## Temel API'ler

Özellik `localStorage`, `MutationObserver`, `Event`, `CustomEvent`, `Element.closest`, `classList`, `textContent` ve standart form alanlarına dayanır.

## Chromium tabanlı

Güncel Chromium sürümlerinde dialog, textarea, keyboard event ve localStorage akışı beklenen şekilde çalışır.

## Firefox

Aynı DOM ve storage API'leri kullanılır. Clipboard desteği bulunmuyorsa yalnız kopyalama eylemi etkilenir; composer aktarımı etkilenmez.

## Safari/WebKit

`metaKey` üzerinden macOS kısayolu, standart input eventleri ve local storage kullanılabilir. Clipboard izni tarayıcı politikalarına bağlı olabilir.

## PWA

Kurulu PWA ile normal browser arasında aynı JavaScript kodu kullanılır. Service worker yalnız shell asset dağıtımını etkiler.

## Degrade davranış

MutationObserver kullanılamadığında canlı hint eklentisinin gözlem katmanı çalışmaz; Smart Fill'in temel formu yine kullanılabilir. Clipboard API yoksa kopyalama hata mesajı verir.

## Güvenlik

Tarayıcı farklılıkları herhangi bir fallback'te `innerHTML` veya remote network kullanma gerekçesi oluşturmaz.

## Mobil

Küçük viewport'larda panel dikey alanı kullanır; değişken etiketleri input üstüne geçer. Command palette tam ekranı kaplamadan sıkıştırılmış modal olarak görünür.

## Klavye

Desktop kısayolların yanında butonlar ve standart form tab akışı korunur. Touch cihazda tüm temel işlemler görünür butonlarla yapılabilir.

## Release tavsiyesi

Browser sürüm desteği, feature JS/CSS'in yüklenip yüklenmediği üzerinden kontrol edilmelidir; analytics ile kullanıcı agent takibi yapılmaz.
