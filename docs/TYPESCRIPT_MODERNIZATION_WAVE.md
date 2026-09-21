# TypeScript Modernizasyon Dalgası

## Amaç

Hafize'nin browser tarafındaki büyük çalışma alanı modüllerini JavaScript uygulama dosyalarından TypeScript kaynaklarına geçirmek; üretimde yalnızca derlenmiş Vite/Rolldown çıktılarının çalıştırılması.

Bu dalganın kapsamı:

- Markdown Renderer
- Conversation Workspace
- üretim entrypoint sözleşmeleri
- PWA shell cache yolu
- legacy JavaScript uyumluluk köprüleri
- modern toolchain pinleri ve migration gate'leri

## Toolchain

Güncel üretim tabanı Node.js 24.21+ olarak korunur. Bu sürüm hattı güncel LTS hattıdır.

Derleme tarafında TypeScript 7.0.2, Vite 8.3.0 ve Vitest 5.0.1 sabitlenmiştir.

TypeScript kaynakları strict modda derlenmeye devam eder. Büyük legacy browser modülleri bu dalgada davranış eşdeğerliğini korumak için açık bir migration işareti taşır; sonraki dalgalarda iç tipler kademe kademe sıkılaştırılır.

## Entry architecture

Üretim HTML artık büyük tarayıcı modüllerini doğrudan kaynak JavaScript'ten çağırmaz.

Kaynak:

`public/markdown-renderer.ts`
`public/conversation-workspace.ts`
`public/typed/message-workspace.ts`
`public/typed/prompt-library.ts`
`public/typed/scheduled-tasks.ts`

Derlenmiş entry:

`/typed-build/markdown-renderer.js`
`/typed-build/conversation-workspace.js`

Vite geliştirme sunucusu, `/typed-build/*.js` isteklerini ilgili TypeScript kaynaklarına çevirir. Production build ise Vite/Rolldown üzerinden gerçek JavaScript çıktısı üretir.

## Legacy bridge policy

`public/markdown-renderer.js` ve `public/conversation-workspace.js` artık uygulama mantığı içermez.

Bu dosyalar:

- yalnızca derlenmiş TypeScript entrypoint'ine dynamic import yapar,
- ağ isteği başlatmaz,
- DOM uygulama mantığı taşımaz,
- kimlik doğrulama bilgisi içermez,
- eski dış entegrasyonların dosya yoluna dayanması durumunda geri uyumluluk sağlar.

Yeni özellikler legacy bridge dosyalarına eklenmez.

## PWA

Service worker shell cache'i TypeScript'ten üretilen entrypoint'leri saklar.

Cache sürümü `hafize-shell-v36` ile değişmiştir; eski cache'ler mevcut cleanup politikasına göre temizlenir.

## Doğrulama

Modern gate zincirinde:

1. TypeScript compiler
2. runtime TypeScript compiler
3. Vitest
4. format kontrolü
5. modern toolchain contract
6. legacy entry contract
7. TypeScript migration contract
8. TypeScript migration depth
9. typed entrypoint release contract
10. security entrypoint contract
11. TypeScript UI migration wave contract

sıralı olarak çalışır.

## Sonraki dalgalar

Bu dalga bilinçli olarak iki büyük browser modülüyle sınırlıdır. Sıradaki güvenli migration grupları; Message Workspace, Hands-Free, Scheduled Tasks ve Prompt Library yardımcı yüzeyleridir.

Her grupta aynı sıra korunur:

kaynak TypeScript -> Vite entry -> HTML migration -> PWA cache -> legacy bridge -> contract test -> type tightening.

## Geri alma

Typed entrypoint değişiklikleri revert edildiğinde legacy bridge dosyaları mevcut davranışı tekrar taşıyabilir. PWA cache sürümü geri alınan commit ile eşleşmelidir.

Kod davranışı değiştirmeden yalnızca dosya uzantısını değiştirmek migration kabul edilmez. Her migration dalgası build entrypoint, test sözleşmesi ve runtime yükleme yoluyla doğrulanmalıdır.
