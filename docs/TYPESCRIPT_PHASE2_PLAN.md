# TypeScript phase 2 plan

## Kapsam

Bu turda server'ın güvenlik, agent, model ve schedule çekirdekleri TypeScript'e geçirildi. İkinci faz aynı yöntemi connector, persistence ve HTTP route domainlerine uygulamalıdır.

## Sıralama

1. ~~GitHub, Gmail ve Canva connector adapter'larını typed contracts ile çevrelemek.~~
   Tamamlandı: `github-read`, `github-workspace`, `github-workspace-extra`,
   `oauth-token-store-runtime`, `canva-read-client`, `canva-read-tool-boundary`,
   `gmail-read-client`, `gmail-read-tool-boundary` ve `plaintext-credential-policy`
   TypeScript kaynağına taşındı; eski `.mjs` adları tek satırlık re-export köprüsü.
   Ayrıntılar `docs/TYPED_GATE_REPAIR.md` içinde.
2. Memory ve storage modellerini branded identifiers ile ayırmak.
3. Chat request/stream response sözleşmesini discriminated unions ile tiplemek.
4. Tool catalogue'u permission, availability ve approval alanlarını aynı union altında birleştirmek.
5. Skill registry manifestini typed schema validation ile yüklemek.
6. Son kalan .mjs yapraklarını domain bazında azaltmak.

## Her adımın DoD'si

- Runtime importu .ts olmalı.
- En az bir davranış testi bulunmalı.
- Security boundary korunmalı.
- Public API compatibility açıkça doğrulanmalı.
- Base-to-head diff 3000 sınırını aşmamalı.
- Legacy modül gerçekten gereksiz hale geldiyse silinmeli.

## Sonraki kök neden

Tarayıcı modülleri `public/typed/*.ts` altına taşındı, ancak `scripts/` altındaki
kaynak-sözleşme paketlerinin büyük kısmı hâlâ `public/<ad>.js` köprüsünü okuyor.
Kalan başarısız paketlerin çoğunun tek nedeni budur; paketleri tipli kaynağa
yöneltmek bir sonraki turun iş paketidir.

## Anti-patternler

Toplu rename, yalnızca dosya uzantısı değiştirme, otomatik type annotation gürültüsü, kullanılmayan facade ve test yerine snapshot şişirmesi kabul edilmez.

## Release sırası

Typed implementation önce staging'de çalıştırılır. Legacy fallback yalnız hata durumunda kullanılır. Başarılı gözlemden sonra legacy import kaldırılır.

## Teknoloji yükseltme notu

Node 24+ type stripping sayesinde küçük server modülleri ayrı bir TS runtime wrapper olmadan çalıştırılabilir. Build ve typecheck ise TypeScript compiler ve Vite üzerinden doğrulanmaya devam eder.
