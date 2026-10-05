# Üretim Kontrolü — Migration

## Önceki durum

Hafize SSE katmanı zaten AbortSignal kabul ediyordu ancak browser app-shell kullanıcıya doğrudan bir durdurma kontrolü sunmuyordu. Üretim durumu yalnız stream-state üzerinden görünüyordu.

## Yeni durum

Typed generation-control.ts ayrı bir lifecycle supervisor katmanı sağlar. App-shell yalnız controller contract'ını tüketir ve SSE istemcisine aynı AbortSignal'i geçirir.

Bu ayrım stream parsing ile kullanıcı kontrolünün birbirine karışmasını engeller.

## Veri uyumluluğu

Conversation storage formatı değiştirilmez. Generation history ayrı localStorage alanındadır:

hafize.generation-control.history.v1

Mevcut conversation kayıtlarına yeni alan eklenmesi gerekmez.

## API uyumluluğu

HafizeSseClient.stream() mevcut options.signal alanını kullanır. Diğer typed stream tüketicileri generation-control'a bağlanmak zorunda değildir.

## PWA uyumluluğu

Yeni stylesheet shell listesine eklenir. Controller için ayrı runtime JS dosyası üretilmez; app-shell bundle import grafiği üzerinden derlenir.

## Legacy cleanup

Obsolete browser compatibility bridge kaynakları kaldırıldı. HTML yalnız typed-build entrypoint'lerini yükler.

Migration gate'leri public/sw-policy.ts üzerinden çalışır ve eski sw-policy.js/v41/v54 varsayımlarına bağlı değildir.

## Rollback

Öncelikli rollback generation-control importu ve app-shell bağlantısıdır. History ayrı bir key olduğu için conversation verisi rollback'ten etkilenmez.

## Kabul kriterleri

- production server entry TypeScript,
- browser legacy bridges yok,
- stop native button ile erişilebilir,
- AbortSignal gerçek SSE request'e geçer,
- partial response korunur,
- history prompt/response içermez,
- release gate'leri güncel TypeScript kaynaklarını okur.
