# GitHub Güvenli Yazma Uyumluluğu

## Mevcut workspace
Read-only GitHub workspace endpoint'leri korunur. Yeni write endpoint'leri ayrı path altında bulunur.

## Auth
Mevcut browser auth fetch wrapper, POST isteklerine CSRF header eklemeye devam eder. Safe write yeni bir auth mekanizması icat etmez.

## Vite
Write UI typed entry olarak Vite build'e eklenmiştir. Development'ta typed source, production'da typed-build artifact yüklenir.

## PWA
Write CSS ve typed JS shell asset listesine eklenmiştir. API yanıtları shell cache'e girmez.

## Browser support
UI standard DOM APIs, Fetch, Clipboard ve sessionStorage kullanır. Clipboard yoksa yalnız history kopyalama yardımcı fonksiyonu başarısız olur; GitHub write akışı için Clipboard zorunlu değildir.

## Depolama
Mevcut Prompt Library, conversation, message workspace, model preference ve backup anahtarları değiştirilmez. Write history bağımsız sessionStorage anahtarı kullanır.

## TypeScript
Writer backend lib/github-workspace-write.ts, UI public/github-workspace-write.ts ve mevcut strict TypeScript/Vite zincirine dahil edilir.
