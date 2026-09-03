# Hafize self-development durum kaydı

Bu dosya otomatik geliştirme turlarının birbirini görebilmesi içindir. Her tur
başında okunur, tur sonunda güncellenir. Amaç aynı işin farklı branch'lerde
tekrar tekrar yazılmasını ve inceleme kuyruğunun şişmesini engellemektir.

Son güncelleme: 2026-09-03.

## `main` doğrulama kapısı

`main` üzerinde `npm run check` **2026-08-14'ten beri kırmızıydı**. PR #107 ile
`gmail_read`, öncesinde `canva_read` aracı eklendiğinde
`scripts/test-tool-runtime.mjs` içindeki `listToolPermissions()` beklentisi
güncellenmemişti. Zincir ilk hatada durduğu için sonraki testler hiç
çalışmıyordu; bu da ikinci bir hatayı gizliyordu:
`gmailReadClient.read(null)` sözleşme hatası yerine ham `TypeError` üretiyordu.

Her iki hata da bu turda onarıldı; kapı yerelde tam yeşil
(`npm run check` → tüm hedefler geçti).

## Açık PR yığılması

- 2026-09-03 itibarıyla **722 açık PR**, buna karşılık toplam **12 merge**.
- Son merge: PR #111, 2026-08-14.
- 2026-09-02/03 turlarının çoğu (#681–#737 aralığı) birbirinden bağımsız olarak
  **aynı iki işi** yeniden yazdı: kırmızı check kapısının onarımı ve
  "strict skills manifest + registry" katmanı.

Bu tekrar, turların açık PR listesini okumamasından kaynaklanıyordu.
`HAFIZE_RULES.md` içine "Tekrar eden tur ve PR yığılmasını önleme" bölümü
eklenerek kural seviyesinde bağlandı.

## Yerelde doğrulanmış açık PR'lar

Aşağıdaki branch'ler bu turda fetch edilip `npm run check` ile çalıştırıldı:

| PR | Branch | Kapı | İçerik |
| --- | --- | --- | --- |
| #734 | `claude/wizardly-sagan-kn87lz` | yeşil (247 kontrol) | Keşif tabanlı `scripts/run-checks.mjs` + iki gerçek hata onarımı |
| #736 | `claude/wizardly-sagan-wuf9il` | yeşil | Kapı onarımı + strict skills manifest ve registry |
| #735 | `claude/wizardly-sagan-mx567f` | yeşil | Kapı onarımı + sınır girdilerinin fail-closed hâle getirilmesi |

## Önerilen merge sırası (karar kullanıcıya aittir)

1. **#734** — kapıyı `package.json` içindeki elle bakılan uzun zincirden
   kurtarıp diskten keşif tabanlı hâle getirir; bu sınıf regresyonun
   tekrarlamasını yapısal olarak engeller.
2. Bu turun PR'ı — süreç kuralları ve durum kaydı; #734 merge edilirse ortak
   test/istemci düzeltmeleri aynı içerikte olduğu için çakışma beklenmez.
3. **#736** (skills manifest + registry), ardından üzerine stacked **#737**
   (alt ajan yaşam döngüsü).
4. Kalan yüzlerce PR: aynı konudaki eski kopyalar kapatılabilir; tekrar
   üretilmemeleri için yeni kural yeterlidir.

## Sıradaki iş

`docs/CLAUDE_RESEARCH_INTEGRATION.md` uygulama sırasına göre:

1. (bu turda) memory consolidation çekirdeği — `lib/memory-consolidation.mjs`.
2. Calendar/reminder read-first connector; yazma işlemleri `external.write`
   onayı olmadan çalışmaz.
3. Reviewer kalite kapılarına privacy, RAG evidence, UI finish ve credential
   hygiene kontrollerinin eklenmesi.
