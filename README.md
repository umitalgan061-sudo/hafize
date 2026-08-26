# Hafize

Hafize yapay zeka uygulaması deposu.

> Bu ilk commit yalnızca tamamen boş GitHub deposunu başlatmak ve sonraki tüm geliştirmeleri branch + Pull Request akışına geçirmek için oluşturulmuştur.

## Doğrulama

```bash
npm run check
```

Kapı `server.mjs`, `lib/`, `scripts/` ve `public/` için sözdizimi kontrolünü, agent registry doğrulamasını ve `scripts/test-*.mjs` altındaki tüm testleri çalıştırır. İlk hatada durmaz; başarısız olan her hedefi çıktısıyla birlikte raporlar. Ayrıntılar: `docs/CHECK_GATE.md`.

Yeni test eklemek için `scripts/test-<konu>.mjs` dosyasını oluşturmak yeterlidir; kapı onu otomatik bulur.
