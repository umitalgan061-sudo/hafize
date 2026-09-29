# Model ve Ajan Tercihleri Triage

## 1. Panel görünmüyor

Model select, agent select ve tool mode düğmesinin DOM'da bulunduğunu kontrol et.
App shell typed bundle'ının yüklendiğini kontrol et.
Browser console içinde module load hatası olup olmadığını kontrol et.

## 2. Son seçim geri gelmiyor

localStorage içinde hafize.model-preferences.v1 anahtarını kontrol et.
selectedModel değerinin /api/models sonucunda bulunup bulunmadığını kontrol et.
selectedAgentId değerinin /api/agents sonucunda bulunup bulunmadığını kontrol et.

## 3. Profil uygulanmıyor

Streaming durumunu kontrol et.
Profil modelinin mevcut model seçeneklerinden biri olduğunu kontrol et.
Profil ajanının mevcut ajan listesinde olduğunu kontrol et.

## 4. Import başarısız

Dosya boyutunu kontrol et.
JSON parse edilebiliyor mu kontrol et.
Preview içinde candidate, valid ve willImport değerlerini kontrol et.
CapacityRemaining sıfırsa önce kullanıcı onayıyla bir profil silinmelidir.

## 5. Cross-tab stale görünüm

İki sekmenin aynı origin üzerinde olduğunu kontrol et.
Browser storage event'in engellenmediğini kontrol et.
Yalnız hafize.model-preferences.v1 değişikliklerinin senkronize edildiğini unutma.

## 6. Export başarısız

Browser Blob ve object URL desteğini kontrol et.
İndirme politikalarını kontrol et.
Storage bozuk olsa bile mevcut panel state'inin export edilebilir olması beklenir.

## 7. Escalation

Kullanıcıdan secret isteme.
Mümkünse preference export dosyası ve reproduction adımları alın.
Conversation history'yi teşhis amacıyla istemek gerekli değildir.
