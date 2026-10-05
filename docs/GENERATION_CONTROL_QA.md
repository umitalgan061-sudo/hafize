# Üretim Kontrolü — QA

## Kritik senaryolar

### Normal üretim

1. Kullanıcı mesaj gönderir.
2. Controller active olur.
3. SSE olayları ve byte sayaçları artar.
4. Akış tamamlanır.
5. Assistant cevabı persistence'a gider.
6. History'ye completed kaydı eklenir.

Beklenen sonuç: final cevap korunur, kontrol kartı terminal özeti gösterir.

### Kullanıcı durdurması

1. Üretim başlar.
2. Kullanıcı `Üretimi durdur` düğmesine basar.
3. AbortSignal tetiklenir.
4. State aborted olur.
5. Kısmi cevap korunur.
6. History'ye user stop kaydı eklenir.

Beklenen sonuç: yeni hata mesajı eklenmez.

### Boş placeholder durdurması

Akış ilk tokenı üretmeden durdurulursa boş assistant satırı kaldırılır. Conversation storage'da sahte boş cevap kalmaz.

### Regeneration durdurması

Önceki assistant cevabı saklanır. Yeni üretim durdurulursa eski cevap restore edilir ve alternates zinciri bozulmaz.

### Ağ düşmesi

`offline` event'i aktif generation'ı durdurur. UI bağlantı mesajını gösterir; partial answer korunur. Online dönüşü eski SSE'yi yeniden başlatmaz.

### Çift başlangıç

Aktif çalışma varken `begin()` null döndürür. UI'dan ikinci stream açılmaz.

## History sınırları

- 12 kayıttan fazlası tutulmaz.
- Tek kayıt bounded alanlara normalize edilir.
- Duplicate id kayıtları tekilleştirilir.
- Büyük JSON doğrudan kabul edilmez.
- malformed JSON boş history olarak ele alınır.
- storage failure ana chat akışını bozmaz.

## Clipboard

Terminal olmayan state'te tanı kopyalama başarısız döner. Clipboard yazma reddedilirse UI crash olmaz.

## PWA

Generation CSS shell asset listesinde bulunur. `/api/` istekleri cache stratejisinde network-only kalır. Controller ayrı browser JS dosyası olarak index'e eklenmez; app-shell TS bundle'ının import grafiğindedir.

## Regression gates

- `vitest run public/typed/generation-control.test.ts`
- `node scripts/test-generation-control-contract.mjs`
- `node scripts/test-generation-control-security.mjs`
- `node scripts/test-generation-control-a11y.mjs`
- `node scripts/test-generation-control-pwa.mjs`
- `node scripts/test-generation-history.mjs`
- `node scripts/test-typescript-entrypoints-release.ts`

## Release kabulü

TypeScript build başarısızsa release yapılmaz. Generation kontrolü ile chat submit davranışı çakışıyorsa release yapılmaz. Security gate kullanıcı içeriğinin metadata history'ye girdiğini tespit ederse release yapılmaz.
