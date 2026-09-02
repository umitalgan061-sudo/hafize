# Hafize

Hafize yapay zeka uygulaması deposu.

> Bu ilk commit yalnızca tamamen boş GitHub deposunu başlatmak ve sonraki tüm geliştirmeleri branch + Pull Request akışına geçirmek için oluşturulmuştur.

## Geliştirme

```bash
npm install        # yalnızca redis bağımlılığı
npm start          # http://localhost:3000
npm run check      # tüm doğrulama kapısı (npm test ile aynı)
```

`npm run check`, `scripts/test-*.mjs` kalıbındaki tüm suite'leri keşfederek çalıştırır ve
`server.mjs` ile `lib/`, `public/`, `scripts/` altındaki kaynakları sözdizimi taramasından
geçirir. Yeni bir test dosyası eklemek onu kapıya dahil etmek için yeterlidir. Ayrıntılar:
[`docs/CHECK_GATE.md`](docs/CHECK_GATE.md).

Geliştirme kuralları, tur bütçesi ve güvenlik sınırları için:
[`HAFIZE_RULES.md`](HAFIZE_RULES.md).
