# Agency Agents değerlendirmesi ve Hafize entegrasyon kararı

Kaynak proje: `msitarzewski/agency-agents`

## Karar

**Tam depoyu Hafize'ye kopyalamıyoruz. Seçici ve güvenli biçimde entegre ediyoruz.**

Agency Agents esas olarak uzman kişilikleri, görev akışlarını, teslimat beklentilerini ve iletişim kurallarını Markdown ajan tanımlarında paketleyen büyük bir ajan kataloğudur. Kendi başına Hafize'nin ihtiyaç duyduğu zamanlayıcı, NVIDIA NIM inference katmanı, OAuth connector runtime'ı veya güvenli tool-execution sandbox'ı değildir. Bu nedenle kaynak depodaki yüzlerce ajanı ve kurulum scriptlerini doğrudan uygulama runtime'ına taşımak yanlış soyutlama olur.

Buna karşılık üç fikir Hafize için doğrudan değerlidir:

1. **Uzmanlaşmış roller:** Tek dev sistem promptu yerine dar sorumluluklara sahip uzman ajanlar.
2. **Hiyerarşik orkestrasyon:** Selector ajan, specialist ajana dar görev verir; specialist parent yetkilerini miras almaz.
3. **Rol bazlı güvenlik:** Her ajan yalnızca görevi için gereken araçlara erişir; yazma, gönderme ve merge gibi yan etkiler ayrıca onay gerektirir.

Aktif runtime roster'ı tam olarak dört profildir ve `lib/agent-runtime.mjs` bu sayıyı/kimlikleri fail-closed doğrular:

- `minimal-engineer` — varsayılan selector; küçük, geri alınabilir ve test edilebilir geliştirme kapsamını seçer.
- `agency-code-reviewer` — salt-okunur kalite/güvenlik specialist'i; Agency Agents Code Reviewer fikirlerini seçici kullanır.
- `movie-coordinator` — film ve izleme istekleri için selector.
- `handyman-advisor` — pratik bakım/onarım soruları için specialist.

`hafize-general`, `agency-orchestrator` ve `agency-minimal-engineer` artık aktif runtime kimlikleri değildir. Skills prosedürdür; yeni agent sayılmaz. Exact sözleşme `docs/AGENT_ROSTER_CONTRACT.md` içindedir.

## Neden tüm ajanları şimdi almıyoruz?

Kaynak proje çok geniş bir uzman kataloğu sunuyor. Hafize ise kişisel asistan + araç kullanan ajan platformu olacak. Tüm ajanları aynı anda içeri almak şu riskleri doğurur:

- Birbirine yakın roller arasında yönlendirme belirsizliği.
- Büyük prompt/token maliyeti ve daha yüksek gecikme.
- Aynı göreve birden fazla çelişkili talimatın taşınması.
- Gereksiz tool izinlerinin yanlış ajana açılma riski.
- Ajan kataloğu büyüdükçe test/eval yüzeyinin kontrolsüz genişlemesi.
- Hafize'nin kendi ürün kimliğinin üçüncü taraf prompt kataloğuna bağımlı hale gelmesi.

Kaynak projenin kendi kurulum yaklaşımı da takım veya ajan bazında seçime izin verdiğinden, seçici kullanım bu projenin kullanım modeliyle uyumludur.

## Kaynaktan aldığımız mimari dersler

### Hiyerarşik yapı varsayılan

Hafize'nin selector ajanları karmaşık işi alt görevlere ayırabilir, fakat yalnız registry'deki `kind: specialist` hedeflere delege edebilir. Specialist ajanlar birbirleriyle serbest mesh kurmaz. Mesh/peer görüşmesi ancak somut ihtiyaç varsa ve tur/sonlandırma sınırı tanımlanmışsa ayrıca tasarlanabilir; mevcut runtime bunu açmaz.

### Yapılandırılmış ajan sözleşmeleri

Her ajan için en az şu alanlar tanımlanır:

- rol ve görev amacı,
- izin verilen / reddedilen araçlar,
- insan onayı gerektiren yan etkiler,
- yapılandırılmış çıktı sözleşmesi,
- failure/fallback davranışı,
- trace kimliği.

### Least privilege

Ajan kimliği ile tool yetkisi birbirinden ayrılmaz. Örneğin Code Reviewer repo okuyabilir fakat branch'e yazamaz; Minimal Engineer branch yazımı için ayrıca backend onayı gerektirir ve merge yetkisi almaz. Diğer selector/specialist profilleri repo yazımını explicit deny eder.

### Gözlemlenebilirlik

Her alt görev ortak `trace_id` ile loglanır. Delegasyon lifecycle ve task ledger aynı trace altında tutulur. Böylece yanlış bir sonucun hangi alt ajan/araç çağrısından geldiği daha sonra izlenebilir olur.

### Harici içerik = veri

Web sayfası, e-posta, dosya veya üçüncü taraf içerik ajan talimatı olarak kabul edilmez. Harici içerik system/developer prompt'una doğrudan yeni yetki olarak birleştirilmez; gerekli alanlar ayrıştırılıp şemaya göre doğrulanır.

## Hafize runtime'ına bağlama sırası

Temel runtime katmanları artık vardır. Yeni Agency Agents fikri eklenirken sıra şöyledir:

1. Mevcut dört rolden hangisinin sorumluluğuna girdiğini belirle.
2. Mümkünse yeni ajan yerine mevcut role prosedür/skill ekle.
3. Tool permission enforcement'i prompt seviyesinde değil backend kodunda uygula.
4. Yazma/gönderme/merge işlemlerini exact kullanıcı approval sınırında tut.
5. Aynı `trace_id`, cancellation ve task-ledger sözleşmesini koru.
6. Yeni davranışı eval/regresyon testiyle kilitle.
7. Roster genişletmesini normal feature yolu olarak kullanma.

## Sonradan değerlendirilecek uzmanlık fikirleri

Kaynak katalogdan AI Engineer, Backend Architect, Frontend Developer, DevOps Automator, Voice AI Integration Engineer, Prompt Engineer, Identity & Access Engineer, Privacy Engineer, Desktop App Engineer ve SRE gibi roller yararlı prosedür fikirleri sağlayabilir.

Bunlar aktif registry'ye yeni ajan olarak eklenmez. Somut özellik geldiğinde önce mevcut dört ajandan uygun olanının skill/prosedürüne dar biçimde uyarlanır. Roster değişikliği gerekiyorsa bu ayrı mimari karar ve açık inceleme gerektirir.

## Lisans

Agency Agents MIT lisanslıdır. Kaynak ajanlardan fikir/örüntülerin yanında uyarlanmış içerik kullanıldığı için atıf ve MIT lisans bildirimi `THIRD_PARTY_NOTICES.md` içinde korunur.
