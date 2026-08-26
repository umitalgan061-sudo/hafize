# Hafize

Hafize yapay zeka uygulaması deposu.

Claude-benzeri sade bir sohbet deneyimi üzerinde çalışan; NVIDIA NIM modellerini
seçebilen, streaming ve tool-calling destekleyen, zamanlanmış görevleri uygulama
kapalıyken de bulutta yürütebilen, PWA ve masaüstü olarak kurulabilen, sesli
kullanılabilen ve kullanıcı izniyle GitHub / Google / Gmail / Canva gibi
servislerle bağlanabilen kişisel bir yapay zeka çalışma alanı.

Geliştirme kuralları ve tur akışı için `HAFIZE_RULES.md` dosyasına bakın.

## Çalıştırma

```
npm install
npm start            # varsayılan http://127.0.0.1:4173, PORT ile değiştirilir
```

Sunucu, secret'ları yalnız ortam değişkenlerinden okur. Hiçbir API anahtarı
veya OAuth secret'ı `public/` altına, istemci JavaScript'ine veya repoya
yazılmaz.

## Doğrulama

```
npm run check        # tüm syntax + test kapısı
npm run precheck     # yalnız frontend/PWA altkümesi
node scripts/run-checks.mjs --filter=gmail,canva
node scripts/run-checks.mjs --list
```

Kapı kapsamını diskten keşfeder: yeni bir `lib/*.mjs` modülü veya
`scripts/test-*.mjs` dosyası eklendiğinde ayrıca bir listeye kaydedilmesi
gerekmez. Ayrıntılar ve bu tasarımın nedeni için `docs/VERIFICATION_GATE.md`.

## Depo düzeni

| Yol | İçerik |
| --- | --- |
| `server.mjs` | HTTP sunucusu, route wiring ve tool/connector bağlantıları |
| `lib/` | Sunucu tarafı modüller: agent runtime, tool sınırları, OAuth, zamanlama, bellek |
| `public/` | İstemci: sohbet arayüzü, PWA service worker, ses ve ekran paylaşımı |
| `scripts/` | Doğrulama kapısı ve `test-*.mjs` testleri |
| `agents/registry.json` | Ajan kayıt defteri ve ajan başına tool izinleri |
| `docs/` | Mimari kararlar ve güvenlik sözleşmeleri |

## Güvenlik sınırları

- Backend default-deny çalışır; model yalnız agent policy tarafından açıkça
  izin verilmiş araçları görür.
- Dış servislerde yazma/silme işlemleri açık kullanıcı onayı olmadan
  çalışmaz; yazma araçları model tool kataloguna kayıtlı değildir.
- OAuth token'ları şifreli olarak, owner kapsamında saklanır.
- Araç hataları çağırana sabit hata kodlarıyla döner; iç detay veya
  credential sızdırılmaz.
