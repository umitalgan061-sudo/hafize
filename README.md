# Hafize

Hafize yapay zeka uygulaması deposu.

> Bu ilk commit yalnızca tamamen boş GitHub deposunu başlatmak ve sonraki tüm geliştirmeleri branch + Pull Request akışına geçirmek için oluşturulmuştur.

## Geliştirme

```bash
npm run start     # sunucuyu çalıştırır
npm run check     # tüm syntax, registry ve test kontrolleri (npm test ile aynı)
```

`npm run check` testleri `scripts/test-*.mjs` altından otomatik keşfeder ve
ilk hatada durmadan hepsini çalıştırır; ayrıntılar için
[docs/CHECK_GATE.md](docs/CHECK_GATE.md). Geliştirme kuralları için
[HAFIZE_RULES.md](HAFIZE_RULES.md).
