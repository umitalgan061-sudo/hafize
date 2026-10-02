# TypeScript-first frontend mimarisi

Bu turdaki ana hedef, tarayıcı kodunu yalnızca .js dosyalarının uzantısını değiştirmek değil; runtime sözleşmelerini tipli, ölçülebilir ve geri alınabilir bir platform katmanında toplamak.

## Hedef mimari
Frontend kaynakları public/typed/ altında TypeScript olarak tutulur. Vite derlemesi bu kaynakları public/typed-build/ altında browser entrypoint'lere dönüştürür. Geliştirme sunucusunda transformIndexHtml eşlemesi, üretim derlemesiyle aynı giriş noktalarını korurken doğrudan TS kaynaklarıyla çalışmayı sağlar.

Bu yapı mevcut kullanıcı deneyimini korur. Global event adları, localStorage anahtarları, DOM id'leri ve browser API davranışları yeni isimlerle kırılmaz. Eski .js entrypoint'ler yalnızca gerçekten typed build ile değiştirildikten sonra kaldırılır.

## Katmanlar

### Tipli API sınırı
public/typed/hafize-api.ts JSON tabanlı /api/health, /api/models ve /api/agents çağrılarını ortak timeout, retry, parser ve hata sözleşmesi altında toplar. Chat shell artık model ve ajan listesini doğrudan fetch ile okumak yerine bu sınırı kullanır.

### Tipli SSE taşıması
public/typed/hafize-sse.ts yalnızca streaming POST istekleri için kullanılır. Güvenli olmayan otomatik retry uygulanmaz; çünkü /api/chat ve /api/agent/run state-changing işlemler olabilir.
Taşıma katmanı event, id, retry ve çok satırlı data alanlarını işler. JSON veri JSON olarak, JSON olmayan data ise sınırlı metin olarak korunur. [DONE] sentinel'i terminal olaydır.
Akış için maksimum frame boyutu, maksimum tampon boyutu ve maksimum olay sayısı sınırları vardır. Ağ hataları, timeout, abort ve HTTP hataları tipli HafizeSseError ile ayrıştırılır. Response içindeki X-Hafize-Trace-Id yüzeyde tutulur; secret veya konuşma içeriği analytics'e gönderilmez.

### Storage sınırı
public/typed/hafize-storage.ts localStorage erişimini bounded ve test edilebilir hale getirir. UTF-8 byte ölçümü kullanılır; key, value ve write limitleri ayrı tutulur. JSON parser callback'i malformed veya beklenmeyen verinin UI'ya doğrudan sızmasını engeller.
Bu katman mevcut ham storage biçimini zorunlu olarak değiştirmez. Bu nedenle migration sırasında kullanıcı verisinin eski formattan yeni forma zorla çevrilmesi gerekmez.

### Async lifecycle
public/typed/hafize-async.ts tekrar tetiklenen UI işlemlerinde önceki operation'ın iptal edilmesini, parent abort aktarımını ve bounded timeout'u tek yaşam döngüsünde toplar.
Controller state'leri idle, queued, running, succeeded, failed ve cancelled olarak modellenmiştir. Operation id ile eski bir isteğin yeni UI state'ini ezmesi engellenir.

### Stream state
public/typed/hafize-stream-state.ts stream'in UI'ya açık durum makinesidir. connecting, streaming, completed, aborted ve failed ayrımı yapılır.
Bu durum makinesi analytics değildir. Veriler bellek içindedir ve sadece mevcut ekranı güncellemek için kullanılır. Son stream'in süre, byte ve event özeti kullanıcıya küçük bir status yüzeyi olarak gösterilir.

## Browser entrypoint sözleşmesi
Aşağıdaki üç bağlantı birlikte korunur: public/index.html, vite.config.ts ve public/sw-policy.js.
Bir modül TS'e taşındığında HTML typed-build girişini, Vite build entry'sini ve Service Worker cache listesini aynı turda güncellemek zorunludur.

## Güvenlik
Frontend TS dosyaları credential saklamaz. NVIDIA, GitHub, Google ve Canva secret'ları server-side kalır.
SSE transport trace-id saklayabilir; fakat kullanıcı mesajı, model çıktısı, access token veya cookie değeri diagnostic state içine alınmaz.
Local storage yüzeyleri kullanıcı cihazında kalır. Storage adapter bilinmeyen anahtarları otomatik temizleme yetkisine sahip değildir.

## Test stratejisi
Vitest testleri typed modüllerin davranışını doğrular. Ek source-contract gate'leri production entrypoint bağlantısını ve legacy dosya kalıntılarını kontrol eder.
Bu turdaki release gate'leri:
- scripts/test-typescript-frontend-wave.mjs
- scripts/test-sse-transport-contract.mjs

Behavioral coverage dosyaları:
- public/typed/hafize-sse.test.ts
- public/typed/hafize-storage.test.ts
- public/typed/hafize-async.test.ts
- public/typed/hafize-stream-state.test.ts

## Geri alma
Bu mimari dal PR üzerinden geri alınabilir. Typed build entrypoint'leri revert edildiğinde taşınan eski .js dosyaları geri getirilebilir; kullanıcı storage biçimini değiştiren bir migration işlemi yoktur.
SSE transport değişikliği app-shell bağımlılığında toplanmıştır. Revert sonrası chat shell önceki taşıma davranışına dönebilir.

## Tamamlanma ölçütleri
Bir frontend modülü migrated kabul edilmeden önce:
- TS kaynak dosyası mevcut olmalı.
- Vite entrypoint'i bulunmalı.
- HTML typed build'i kullanmalı.
- PWA cache typed build'i içermeli.
- legacy entrypoint kaldırılmış olmalı.
- source-contract testi credential benzeri içerik ve hard-coded remote fetch kontrolünü geçmeli.
- Vitest behavioral coverage bulunmalı.

Bu ölçütler sonraki TypeScript migration turlarında aynı standardın tekrar kullanılmasını sağlar.