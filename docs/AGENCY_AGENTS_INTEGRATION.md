# Agency Agents değerlendirmesi ve Hafize entegrasyon kararı

Kaynak proje: `msitarzewski/agency-agents`

## Karar

**Tam depoyu Hafize'ye kopyalamıyoruz. Seçici ve güvenli biçimde entegre ediyoruz.**

Agency Agents esas olarak uzman kişilikleri, görev akışlarını, teslimat beklentilerini ve iletişim kurallarını Markdown ajan tanımlarında paketleyen büyük bir ajan kataloğudur. Kendi başına Hafize'nin ihtiyaç duyduğu zamanlayıcı, NVIDIA NIM inference katmanı, OAuth connector runtime'ı veya güvenli tool-execution sandbox'ı değildir. Bu nedenle kaynak depodaki yüzlerce ajanı ve kurulum scriptlerini doğrudan uygulama runtime'ına taşımak yanlış soyutlama olur.

Buna karşılık üç fikir Hafize için doğrudan değerlidir:

1. **Uzmanlaşmış roller:** Tek dev sistem promptu yerine dar sorumluluklara sahip uzman ajanlar.
2. **Hiyerarşik orkestrasyon:** Ana Hafize, alt ajanlara görev verir; alt ajanlar birbirlerinin yetkilerini miras almaz.
3. **Rol bazlı güvenlik:** Her ajan yalnızca görevi için gereken araçlara erişir; yazma, gönderme ve merge gibi yan etkiler ayrıca onay gerektirir.

İlk entegrasyon `agents/registry.json` içinde dört profil ile başlar:

- `hafize-general` — kullanıcıya görünen ana Hafize.
- `agency-orchestrator` — görev ayrıştırma, delegasyon, task ledger ve sentez.
- `agency-minimal-engineer` — küçük, geri alınabilir ve test edilebilir kod değişiklikleri.
- `agency-code-reviewer` — varsayılan olarak salt-okunur kalite/güvenlik incelemesi.

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

Hafize'nin ana ajanı karmaşık işi alt görevlere ayırabilir, fakat uzman ajanlar birbirleriyle serbest mesh kurmaz. Mesh/peer görüşmesi ancak somut ihtiyaç varsa ve tur/sonlandırma sınırı tanımlanmışsa açılır.

### Yapılandırılmış ajan sözleşmeleri

Her ajan için en az şu alanlar tanımlanır:

- rol ve görev amacı,
- izin verilen / reddedilen araçlar,
- insan onayı gerektiren yan etkiler,
- yapılandırılmış çıktı sözleşmesi,
- failure/fallback davranışı,
- trace kimliği.

### Least privilege

Ajan kimliği ile tool yetkisi birbirinden ayrılmaz. Örneğin Code Reviewer repo okuyabilir fakat branch'e yazamaz; Minimal Engineer branch'e yazabilir fakat merge edemez; Orchestrator ise varsayılan olarak dış sisteme yazamaz.

### Gözlemlenebilirlik

Her alt görev ortak `trace_id` ile loglanacak. Orchestrator bir `task ledger` tutacak. Böylece yanlış bir sonucun hangi alt ajan/araç çağrısından geldiği daha sonra izlenebilir olacak.

### Harici içerik = veri

Web sayfası, e-posta, dosya veya üçüncü taraf içerik ajan talimatı olarak kabul edilmeyecek. Harici içerik system/developer prompt'una doğrudan birleştirilmeyecek; gerekli alanlar ayrıştırılıp şemaya göre doğrulanacak.

## Hafize runtime'ına bağlama sırası

Bu PR yalnızca güvenli ajan kayıt sözleşmesini ekler. Runtime entegrasyonu aşağıdaki sırayla yapılmalıdır:

1. NVIDIA NIM server-side chat/streaming katmanı.
2. `agents/registry.json` için doğrulayıcı loader.
3. Kullanıcı isteğine göre ajan seçimi/router.
4. Alt ajan çağrıları için ortak `trace_id` + task ledger.
5. Tool permission enforcement — prompt seviyesinde değil, backend kodunda.
6. Yazma/gönderme/merge işlemleri için kullanıcı onay kapısı.
7. Ajan ve pipeline eval testleri.
8. Gerektikçe yeni uzman rollerin seçici eklenmesi.

## Sonradan değerlendirilecek uzmanlıklar

Kaynak katalogdan Hafize'nin yol haritasıyla özellikle ilişkili görünen roller şunlardır:

- AI Engineer
- Backend Architect
- Frontend Developer
- DevOps Automator
- Voice AI Integration Engineer
- Prompt Engineer
- Identity & Access Engineer
- Privacy Engineer
- Desktop App Engineer
- SRE

Bunların hiçbiri yalnızca mevcut olduğu için eklenmeyecek. Somut özellik geldiğinde, rol gerçekten ayrı bir sorumluluk ve farklı tool policy gerektiriyorsa eklenir.

## Lisans

Agency Agents MIT lisanslıdır. Kaynak ajanlardan fikir/örüntülerin yanında uyarlanmış içerik kullanıldığı için atıf ve MIT lisans bildirimi `THIRD_PARTY_NOTICES.md` içinde korunur.
