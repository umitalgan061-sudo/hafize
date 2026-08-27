# Hafize

Hafize yapay zeka uygulaması deposu.

> Bu ilk commit yalnızca tamamen boş GitHub deposunu başlatmak ve sonraki tüm geliştirmeleri branch + Pull Request akışına geçirmek için oluşturulmuştur.

## Geliştirme

```bash
npm run check      # tam doğrulama kapısı: syntax + tüm testler
npm run precheck   # hızlı UI alt kümesi
npm start          # yerel sunucu
```

`npm run check` hedeflerini `scripts/run-checks.mjs` üzerinden kendisi keşfeder:
`lib/`, `public/` ve `scripts/` altına eklenen her modül ve her `test-*.mjs`
dosyası ek bir kayıt adımı olmadan kapıya dahil olur. Ayrıntılar için bkz.
[docs/VERIFICATION_GATE.md](docs/VERIFICATION_GATE.md).

Geliştirme akışı ve tur kuralları için bkz. [HAFIZE_RULES.md](HAFIZE_RULES.md).

