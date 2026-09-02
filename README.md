# Hafize

Hafize yapay zeka uygulaması deposu.

> Bu ilk commit yalnızca tamamen boş GitHub deposunu başlatmak ve sonraki tüm geliştirmeleri branch + Pull Request akışına geçirmek için oluşturulmuştur.

## Geliştirme

```bash
npm run check        # sözdizimi + tüm test süitleri (PR öncesi zorunlu)
npm run check:syntax # yalnızca sözdizimi kontrolü
npm start            # yerel sunucu (server.mjs)
```

Doğrulama kapısı dosyaları keşfederek çalışır: yeni bir `lib/*.mjs`,
`public/*.js` veya `scripts/test-*.mjs` eklendiğinde ayrıca `package.json`
düzenlemek gerekmez. Ayrıntı: [docs/CHECK_GATE.md](docs/CHECK_GATE.md).

Geliştirme kuralları ve tur bütçesi: [HAFIZE_RULES.md](HAFIZE_RULES.md).
