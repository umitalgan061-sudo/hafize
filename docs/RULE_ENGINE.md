# Kural motoru (proaktif davranış)

`lib/rule-engine.ts`, Hafize'yi "sadece tetiklendiğinde çalışan" bir asistandan, olay ve zamana
karşı kendi başına harekete geçen bir ajana dönüştüren katmandır. "Bu dosya değişince testleri
koş", "Her sabah 09:00'de günlük özet çıkar" gibi kurallar burada tanımlanır.

Mevcut `task-schedule-store` + `schedule-worker` zinciri tek atımlık (`runAt`) zamanlama sağlar.
Kural motoru bu zinciri **yeniden yazmaz**, onun üstünde iki eksik parçayı ekler: yinelenen
cron takvimi ve olay tetikliyoru.

## Model

```
Kural = { id, ownerId, name, description, trigger, task, agentId, cooldownMs, enabled }
Trigger = { kind: 'cron', expression: '0 9 * * *' }
        | { kind: 'event', event: 'file.changed' }
```

Bir kural ya zamana (`tick`) ya da olaya (`emit`) bakarak çalışır. İki yol da aynı `fire()`
içinden geçer; böylece cooldown, guard ve denetim tek yerde uygulanır.

## Bileşenler

| Bileşen | Sorumluluk |
| --- | --- |
| `create(ownerId, input)` | Kuralı doğrular ve ekler. İsim sahibi içinde tekil olmalıdır. |
| `list(ownerId)` | O sahibin kurallarını döndürür. |
| `remove(ownerId, id)` | Kuralı siler; yalnız sahibi silebilir (`RULE_NOT_FOUND`). |
| `setEnabled(ownerId, id, enabled)` | Duraklat / devam ettir. |
| `tick(at)` | Zaman süpürmesi. Her dakika çağrılır; vakti gelen cron kurallarını çalıştırır. |
| `emit(event, payload)` | Olay yolu. Ada eşleşen tüm kuralları payload ile çalıştırır. |

## Cooldown ve guard

- **Cooldown** (`cooldownMs`, varsayılan 60 sn): gürültülü bir dosya izleyicisinin ajanı
  saniyede bir dövmemesini sağlar. Vakti gelen ama cooldown'daki kural `{ fired: false,
  reason: 'cooldown' }` olarak raporlanır — sessice atlanmaz, böylece neden bir şeyin
  çalışmadığı görülebilir.
- **Guard** (isteğe bağlı): her ateşlemeden önce çağrılır; `false` dönerse kural atlanır.
  Özellik bayrakları, çalışma saatleri gibi koşullar buraya bağlanır.

Ateşleme, görev çalıştırılmadan **önce** işaretlenir. Böylece yavaş bir görev eşzamanlı bir
olay tarafından ikinci kez başlatılamaz.

## Cron desteği

Beş alanlı standart cron: `dakika saat gün-ay ay gün-hafta`.

- Liste: `0,30 * * * *`
- Aralık: `0 9-17 * * 1-5`
- Adım: `*/15 * * * *`
- `7` ve `0` aynı şeydir (Pazar).

Geçersiz ifadeler kayıt anında `INVALID_RULE_CRON` ile reddedilir; çalışma anında değil.

## Olay eşleştirme

Olay adı `file.changed`, `build.finished`, `test.completed` gibi bir kimliktir. `emit` yalnız
`trigger.event === event` olan kuralları çalıştırır; payload kuralın görevine bağlam olarak
geçer. Glob eşleştirmesi (`globToRegExp`) yardımcı olarak sunulur: `src/**/*.ts` deseni bir
dosya yoluna uyuyor mu kontrolü çağıran tarafa bırakılır, böylece motor kendisi yoldan bağımsız
kalır.

## Yetki sınırı

Motor hiçbir yetkiyi genişletmez. Bir kural çalıştığında görev, sahibinin kendi ajanı altında
`task-schedule-store`'a bir görev olarak eklenir; yani izinler kullanıcının mevcut policy'siyle
sınırlı kalır. Motor sadece "ne zaman" kararını verir, "ne yapabilir" kararını vermez.

## server.ts bağlantısı

- Motor `createHafizePlatform` içinde kurulur ve `PLATFORM.ruleEngine` olarak dışa açılır; böylece
  tool'lar ile zamanlayıcı döngüsü **tek bir örnek** paylaşır.
- `run` geri çağrısı `scheduleRuleTask` bağımlılığına delege eder. `server.ts` bunu
  `TASK_SCHEDULE_STORE.add(...)` ile bağlar; store platformdan sonra oluştuğu için bağlantı
  tembel (lazy) çözülür.
- `startRuleEngineLoop()` dakikada bir `PLATFORM.ruleEngine.tick()` çağırır.
  `stopRuleEngineLoop()` ise `createShutdownCoordinator` içinde schedule worker ile birlikte
  durdurulur.

## Tool'lar

`agents/registry.json` içinde `hafize-general`, `agency-minimal-engineer` ve `agency-code-reviewer`
ajanları `rule.create` / `rule.read` izinlerine sahiptir.

| Tool | İzin | İşlev |
| --- | --- | --- |
| `rule_create` | `rule.create` | Yeni kural tanımlar (cron veya event). Yalnızca *ne zaman* kararını verir; işlem sahibinin kendi ajanıyla koşar. |
| `rule_list` | `rule.read` | Kullanıcının kurallarını listeler. |
| `rule_remove` | `rule.create` | Kuralı siler. |
| `rule_set_enabled` | `rule.create` | Kuralı duraklatır / devam ettirir. |

Tümü sahip bazlıdır: bir kullanıcı yalnızca kendi kurallarını görebilir ve yönetebilir
(`RULE_NOT_FOUND`).

## Test

`npx vitest run lib/rule-engine.test.ts` — 16 test: cron ayrıştırma (liste/aralık/adım/`*`,
Pazar normalizasyonu, geçersiz ifadeler), tarih eşleştirme, glob derleme, kural oluşturma ve
doğrulama, sahip bazlı listeleme/silme, olay ile çalıştırma, cooldown, devre dışı bırakma,
guard, cron tick, hata durumunda kuralın korunması.

`npx vitest run lib/rule-authoring-tools.test.ts` — 2 test: platform üzerinden kural oluşturma,
sahip bazlı listeleme/silme/duraklatma ve cron kuralı ateşlendiğinde görevin
`scheduleRuleTask` ile planlanması.
