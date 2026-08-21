# Hafize

Hafize yapay zeka uygulaması deposu.

Geliştirme kuralları için `HAFIZE_RULES.md`, mimari kararlar için `docs/` klasörüne bakın.

## Doğrulama

```bash
npm run check      # tam kapı: syntax + registry + tüm testler
npm run precheck   # hızlı statik geçiş: yalnız syntax
```

Kapı, kontrol edeceği dosyaları diskten keşfeder; ayrıntılar `docs/CHECK_GATE.md` içinde.
