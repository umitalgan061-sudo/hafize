# Modernizasyon release checklist

## Kaynak

- [ ] Yeni browser kodu strict TypeScript ile yazıldı.
- [ ] Migration edilen eski JavaScript entry HTML'den çıkarıldı.
- [ ] Global bridge isimleri geriye dönük davranışı koruyor.
- [ ] `unknown` dış kaynak verileri normalize ediliyor.
- [ ] Kullanıcı metni HTML string interpolation ile yazılmıyor.

## Build

- [ ] Node 24 LTS engine tanımı güncel.
- [ ] `npm run typecheck` başarıyla tamamlanıyor.
- [ ] `npm run build` generated typed entries üretiyor.
- [ ] Generated output `public/typed-build` altında kalıyor.
- [ ] Production start build olmadan başlamıyor.
- [ ] Vite development API proxy yalnızca loopback backend'e yöneliyor.

## Runtime

- [ ] API client timeout kullanıyor.
- [ ] Transient 429/5xx hatalarında bounded retry var.
- [ ] 4xx hataları gereksiz retry almıyor.
- [ ] Trace id saklanıyor.
- [ ] Network offline durumu UI'da gösteriliyor.
- [ ] Health panelinde secret/token bulunmuyor.

## PWA

- [ ] Service worker cache sürümü artırıldı.
- [ ] HTML'deki generated entry'ler shell cache içinde.
- [ ] API yolları network-only.
- [ ] Legacy migration entry'leri cache listesinde kaldırıldı.
- [ ] Cache listesi HTML ile iki yönlü kontrat testiyle doğrulanıyor.

## Test

- [ ] Vitest typed unit tests.
- [ ] API retry/error/timeout tests.
- [ ] Hostile payload normalization tests.
- [ ] Command Palette search tests.
- [ ] Smart Fill variable tests.
- [ ] Scheduled countdown edge tests.
- [ ] Legacy entry contract.
- [ ] Modern toolchain source contract.
- [ ] Format check.
- [ ] Repository'nin mevcut `npm test`/`npm run check` suite'i.

## Rollback

- [ ] Generated entry referansları geri alınabilir.
- [ ] Source migration commitleri bağımsız revert edilebilir.
- [ ] Service worker cache sürümü önceki güvenli sürüme döndürülebilir.
- [ ] Backend değişikliği olmadan frontend rollback mümkün.
- [ ] Rollback sonrası `npm start` temiz build alabiliyor.

## Güvenlik

- [ ] Secret veya connector credential browser bundle'a eklenmedi.
- [ ] API client otomatik Authorization eklemiyor.
- [ ] Local prompt data telemetriye taşınmıyor.
- [ ] Error detail bounded.
- [ ] Storage erişimi failure-safe.

## Release evidence

PR açıklamasında base SHA, head SHA, changed-line toplamı, çalıştırılan testler, çalıştırılamayan testler ve rollback yolu yazılmalıdır.

Modernizasyonun amacı yalnızca daha yeni dil kullanmak değildir. Daha güçlü type contracts, deterministic build, test edilebilir browser boundary'leri ve güvenli rollback sağlayan bir mühendislik zemini oluşturmaktır.
