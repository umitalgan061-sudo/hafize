# Dosya ekleri: içerik sohbete yazılmaz

Metin ve kod dosyaları eklenirken ham içerik artık sohbet kutusuna **yazılmaz**. Composer yalnızca
tek satırlık bir referans gösterir; asıl içerik sunucuda şifreli saklanır ve modele istek anında
ilet

## Neden

Eskiden bir `.gitignore` veya büyük bir kaynak dosyası eklediğinizde tüm içerik metin kutusuna
akış içeriği:
- Yazıyor olduğunuz mesajın arasında kayboluyordu,
- Ek alanı okunamaz hâle geliyordu,
- Kullanıcı kendi mesajını göremiyordu.

Artık eklenen dosya için metin kutusuna sadece şu gider:

```
[Ekli dosya: gitignore.txt](/api/documents/doc_a8507681e5d461a61a4a)
```

Kullanıcıya gösterilen bildirim: *"gitignore.txt eklendi; içeriği sohbete yazılmadı, Hafize dosyayı
okuyacak."*

## Akış

```
Tarayıcı                          Sunucu
────────                          ──────
dosya seçildi
  │
  ├─ POST /api/uploads/document ──► documents tablosuna yaz
  │  { content, name, mime }      (içerik sahibin anahtarıyla şifreli)
  │◄───────────────────────────── { id, url: /api/documents/doc_... }
  │
  └─ metin kutusuna SADECE referansı koy
     [Ekli dosya: ad](/api/documents/doc_...)

mesaj gönderildi
  │
  ├─ POST /api/agent/run ─────────► analyzeAttachments():
  │  { messages: [...] }             referansı bul → içeriği çöz →
  │                                  modele ek metin olarak ilet
  │                                  (untrusted olarak işaretlenir)
  │◄───────────────────────────── yanıt
```

Model içeriği alır; kullanıcı yalnızca referansı görür.

## Güvenlik

| Kural | Nasıl sağlanır |
| --- | --- |
| İçerik sahibinden başkasına görünmez | `documents.read(id, ownerId, cipher)` hem satırı hem de şifreyi sahibe bağlar; başka sahip `null` alır. |
| İçerik dinlenmeye karşı şifreli | `OwnerCipher.encrypt()` — hafıza kayıtlarıyla aynı envelope crypto. |
| İçerik hiçbir API'den dönmez | Yalnızca `POST /api/uploads/document` (kabul) ve `DELETE /api/documents/<id>` vardır; içeriği okuyan bir endpoint yoktur. |
| Yüklenen içerik "güvensiz" sayılır | `analyzeAttachments()` `untrusted: true` döner; `server.ts` bunu `memorySession.markUntrustedContent()` ile işaretler. |
| Sahip başına sınır | En fazla 50 doküman; dolduğunda en eskisi düşer. |
| Boyut sınırı | 50 MB / 50 M karakter; aşanında `DOCUMENT_TOO_LARGE` (413). |
| Dosya adı güvenli | `\0`, `\r`, `\n` temizlenir, 120 karakterle sınırlanır. |

## Sınırlar

| Sınır | Değer |
| --- | --- |
| Dosya başına boyut | 50 MB (istemci) / 50 M karakter (depo) |
| Mesaj başına ek sayısı | 20 |
| Sahip başına saklanan doküman | 50 (dolduğunda en eskisi düşer) |
| Mesajda genişletilen doküman | 20 |
| Dosya adı | En fazla 120 karakter; `\0`, `\r`, `\n` temizlenir |

Eskiden istemci tarafında 384 KB sınırı vardı; bu kaldırıldı. Yüklenen içerik metin kutusuna
yazılmadığı için büyük dosyalar da ek alanını şişirmiyor.

## Model yönündeki bütçe (önemli)

Depo sınırları büyük, ama **modele giden toplam sınırlıdır**: mesaj başına genişletilen ek içeriği
en fazla **200.000 karakter** (~50.000 token).

Nedeni: `normalizeClientMessages` kullanıcının kendi mesajını 200.000 karakterle sınırlar
(`MAX_MESSAGE_CHARS`), ama ek genişletmesi bu kontrolden **sonra** yapılır. Bir bütçe olmasaydı
birkaç büyük ek prompt'u model bağlamının (128.000 token) çok ötesine taşır, çağrı hata verir veya
çok büyük maliyet doğurur. `context-compaction` eski mesajları özetler ama **son mesajı korur**; dev
ek zaten son mesajda olduğu için sıkıştırma işe yaramaz.

Bütçe aşıldığında:
- Sırayla eklenebildiği kadar ek eklenir,
- Kısılan içerik `[Dosya uzun olduğu için ilk N karakteri eklendi.]` ile işaretlenir,
- Atlanan ekler için modele `[Not: N ek daha vardı ama model bağlam sınırına ulaşıldığı için
  eklenmedi. Kullanıcıya bundan bahset.]` notu gider.

Yani **dosyanızı tamamen yükleyebilirsiniz**; model yalnızca o anki bağlama sığan kısmı görür.

## Uzun metni yapistirma

Metin kutusuna **4000 karakterden uzun** bir metin yapistirirsaniz otomatik olarak metin dosyasina
donusturulur:

- Dosya adi: `yapistirilan-metin-<tarih-saat>.txt`
- Metin kutusuna yalnizca referansi girer, ham metin yapistirilmaz
- Model icerigi yine alir

Kisa yapistirmalar (4000 karakterin alti) normal sekilde metin kutusuna girer.

## API

| Uç | Yöntem | Açıklama |
| --- | --- | --- |
| `/api/uploads/document` | POST | `{ content, name, mime }` → `{ id, url, name, size }` |
| `/api/documents` | GET | Sahibin dokümanlarının listesi (içerik yok) |
| `/api/documents/<id>` | DELETE | Siler |

## Eklenen davranışlar

- **Görsel / PDF / video** değişmedi: bunlar `rich-content.ts` tarafından hazırlanır ve kompakt bir
  işaret ekler (görsel için `![ad](/api/images/img_...)`, taranmış PDF için vision modeli).
- **Sürükle-bırak** korunarak devam eder: dosya metin kutusuna bırakıldığında tarayıcının ham metin
  eklemesi `stopPropagation` + `stopImmediatePropagation` ile engellenir; yalnızca ek oluşur.
- **Ek kaldırma** çalışmaya devam eder: chip'teki `×` metin kutusundaki referans satırını siler.

## Test

- `lib/document-store.test.ts` — 7 test: kaydet/oku/çöz, sahip izolasyonu, boş ve aşırı içerik,
  ad temizleme, referans çıkarma, sahip başına 50 sınırı, listeleme sırası.
- `lib/attachment-expansion.test.ts` — 6 test: referansın modele içerik olarak genişletilmesi,
  eksiz mesaj, başka sahibin referansının yok sayılması, en fazla 20 genişletme, 384 KB'in çok
  üzerindeki dosyanın kabulü ve **model bütçesinin prompt'u sınırlı tutması**.
- `lib/hafize-platform.test.ts` — HTTP uçları: boş içerik reddi, liste ve silme, sahip izolasyonu,
  içeriğin hiçbir yanıtta geçmemesi.
