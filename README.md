# Hafize

Hafize yapay zeka uygulaması deposu.

> Bu ilk commit yalnızca tamamen boş GitHub deposunu başlatmak ve sonraki tüm geliştirmeleri branch + Pull Request akışına geçirmek için oluşturulmuştur.

## Geliştirme

```
npm run check   # tüm kaynakları parse eder ve tüm testleri çalıştırır
npm start       # sunucuyu başlatır
```

`npm run check` hedeflerini diskten keşfeder: yeni bir `scripts/test-*.mjs` dosyası eklemek onu kapıya dahil etmek için yeterlidir, `package.json` düzenlenmez. Kapı ilk hatada durmaz; başarısız her hedefi ayrı ayrı raporlar. Ayrıntı: [`docs/VERIFICATION_GATE.md`](docs/VERIFICATION_GATE.md).

Geliştirme kuralları ve tur akışı için [`HAFIZE_RULES.md`](HAFIZE_RULES.md) dosyasına bakın.
