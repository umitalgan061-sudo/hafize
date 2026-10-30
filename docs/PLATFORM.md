# Hafize ajan platformu

Hafize'nin sunucu tarafındaki yetenekleri ve nasıl yönetileceği. Hepsi bu bilgisayarda çalışır;
dış servis olarak yalnızca NVIDIA (modeller) ve açık web/akademik kaynaklar kullanılır.

## Mimari

| Katman | Dosya | Görev |
|---|---|---|
| Platform | `lib/hafize-platform.ts` | Tüm servisleri kurar, istek başına araç bağlamını ve HTTP API'yi sağlar |
| Veritabanı | `lib/hafize-db.ts` | `data/hafize.db` (Node yerleşik SQLite, FTS5) — sürümlü şema |
| Şifreleme | `lib/envelope-crypto.ts` | Ana anahtar → kullanıcı başına veri anahtarı (AES-256-GCM); arama dizini anahtarlı token özetleri |
| Hafıza | `lib/memory-backend.ts`, `lib/memory-consolidator.ts` | semantic / episodic / procedural; hibrit arama (embedding + BM25 + filtre); sohbet özetleri |
| Araştırma | `lib/research-agent.ts`, `lib/research-sources.ts` | 6 motor, güvenilirlik puanı, iddia kümeleme, çelişki tespiti, APA/IEEE/ISO 690 kaynakça |
| Görev yürütücü | `lib/orchestrator.ts` | Plan (DAG) → paralel adımlar → denetçi → kayıt noktası → bütçe sınırları → insan onayı |
| Uzmanlar | `agents/registry.json`, `lib/expert-registry.ts` | Ajan kartları, keşif, sağlık/SLO, günlük kota, çıktı şeması doğrulama, denetim kaydı |
| Yerel sunucular | `lib/localhost-servers.ts` | `localhost_start/list/stop`: klasörü statik yayınlar, komutu onayla çalıştırır; sayı sınırı yok, yalnız 127.0.0.1 |
| Canlı ekran | `lib/screen-watch.ts`, `public/typed/live-screen.ts` | Değişen kareler görsel modelle metne çevrilir; kare saklanmaz, metin bellekte kalır |
| Telefona kurulum | `lib/local-tls.ts`, `public/typed/app-install.ts` | `HAFIZE_HTTPS_PORT` ile yerel ağda HTTPS; CA yalnız özel adreslerle sınırlı |
| Sandbox | `lib/sandbox-runner.ts` | İzin modeli kısıtlı ayrı Node süreci + vm; dosya/süreç/ağ yok, bellek ve süre sınırı |
| Beceriler | `lib/skill-executor.ts`, `lib/skill-sdk.ts`, `lib/skill-bundles.ts` | Onay, idempotency, şema, denetim, geri alma; Ed25519 imzalı paketler ve güncelleme kanalı |
| Medya | `lib/media-tools.ts`, `lib/headless-browser.ts` | Görsel üretimi (güvenlik denetimli), görsel analiz, diyagram (SVG/PNG), JS sayfa okuma |
| Yerel araçlar | `lib/local-tools.ts` | Çalışma klasörü dosyaları, SQLite, kabuk komutu (her komut onaylı) |
| Gözlem | `lib/telemetry.ts` | OpenTelemetry biçiminde span'lar, token kullanımı, geri bildirim, Prometheus, OTLP |
| Geri alma | `lib/action-journal.ts` | Değişiklik yapan her işlem için telafi kaydı |
| İnsan onayı | `lib/approval-gate.ts` | Riskli adımda akış duraklar, tarayıcıda onay penceresi açılır |
| Yedek | `lib/backup.ts` | scrypt + AES-GCM şifreli anlık görüntü, klasör veya WebDAV, son-yazan-kazanır birleştirme |
| İstem kayıtları | `prompts/` , `lib/prompt-registry.ts` | Sürümlü istemler ve A/B deneyi |

Tarayıcı tarafı: `public/typed/agent-extras.ts` (onay penceresi, geri al düğmeleri, ilerleme,
hafıza eşitleme, geri bildirim), `public/typed/rich-content.ts` (diyagram, matematik, görsel/PDF/video
ekleri), `public/typed/platform-panel.ts` (Ayarlar → Gelişmiş).

## Modelin kullandığı araçlar

`research_run`, `code_run`, `orchestrator_run` / `orchestrator_resume`, `memory_save` (semantic/procedural),
`memory_search`, `memory_consolidate`, `memory_forget`, `expert_find`, `agent_delegate`, `vision_analyze`,
`image_generate`, `diagram_render`, `web_page_render`, `workspace_files`, `workspace_sqlite`, `shell_run`,
`action_undo`, `skill_invoke` ve mevcut web araçları (`web_search`, `web_page_read`, `wikipedia_lookup`,
`news_search`, `weather_forecast`, `exchange_rates`).

Güvenlik kuralları:
- Web, e-posta, dosya, görsel veya kabuk çıktısı okunduktan sonra o çalıştırmada hafızaya yazılamaz.
- `shell_run` ve SQLite değişiklikleri her seferinde kullanıcı onayı ister; onay yoksa çalışmaz.
- Kabuk komutları gizli anahtar içeren ortam değişkenlerini görmez; yerel araçlar çalışma klasörünün dışına çıkamaz.
- Araç sonuçlarında parola/anahtar biçimli metin varsa sonuç bütünüyle engellenir.
- `/api/*` platform uçları oturum gerektirir; görsellere yalnızca sahibi erişir, SVG'ler etkisiz sunulur.

## HTTP API (oturum gerekir)

| Uç | Açıklama |
|---|---|
| `GET /api/capabilities` | Hazır yetenekler |
| `GET/POST/PATCH/DELETE /api/memory` | Hafıza kayıtları (`?q=` hibrit arama, `?kind=`, `DELETE ?confirm=all` tümünü sil) |
| `GET /api/memory/export`, `POST /api/memory/import` | JSONL dışa/içe aktarma |
| `POST /api/memory/consolidate`, `POST /api/memory/dedupe` | Sohbet özeti, yinelenen notları birleştirme |
| `POST /api/approvals/:id` | Onay penceresinin yanıtı |
| `GET /api/actions`, `POST /api/actions/:id/undo` | Geri alınabilir işlemler |
| `GET /api/orchestrator/runs[/:id[/events]]`, `POST …/cancel` | Çok adımlı görevler |
| `GET /api/experts`, `/api/experts/resolve?q=`, `/api/experts/:id/health`, `/api/experts/delegations` | Uzmanlar |
| `GET /api/images`, `GET/DELETE /api/images/:id`, `POST /api/uploads/image` | Görseller |
| `GET /api/observability/summary`, `/traces/:traceId`, `/metrics` | Gözlem |
| `POST /api/feedback` | 👍/👎 (A/B varyantıyla) |
| `GET/POST /api/backup`, `POST /api/backup/restore` | Yedek |
| `GET /api/skills/catalog`, `POST /api/skills/bundles`, `GET/POST /api/skills/updates` | Beceriler |
| `GET /api/prompts` | İstem sürümleri ve deneyler |

Prometheus: `.env` içine `HAFIZE_METRICS_TOKEN` ekleyip `GET /api/metrics?format=prometheus`
(Bearer) — örnek yapılandırma `ops/prometheus/prometheus.yml`, panel `ops/grafana/hafize-dashboard.json`.

## Geliştirici araçları

```bash
npm run skill -- new kdv-hesapla              # skills/user/ altında iskelet
npm run skill -- test kdv-hesapla --args '{"text":"..."}'
npm run skill -- keygen                       # imza anahtarı (özel anahtar skills/keys/ — paylaşma)
npm run skill -- pack kdv-hesapla --version 1.0.0 --key skills/keys/<id>.private.pem
npm run skill -- install skills/dist/kdv-hesapla-1.0.0.bundle.json
npm run eval -- --suite basic                 # altın set; sonuçlar evals/results/
npm run eval -- --suite basic --baseline evals/results/<önceki>.json   # gerileme varsa çıkış kodu 1
npm run eval:redteam                          # prompt injection, sızdırma, araç kötüye kullanımı, jailbreak
```

`--judge` bayrağı her yanıtı vakadaki ölçüte göre hızlı modelle puanlar. VS Code parçacıkları:
`.vscode/hafize.code-snippets` (`hafize-skill`, `hafize-handler`, `hafize-eval-case`).

## İstem sürümleri ve A/B

`prompts/registry.json` her istemin sürümlerini ve deneyini tutar. Sohbet kimliğine göre kararlı bir
varyant seçilir; yanıtlara verilen 👍/👎 varyant bazında Ayarlar → Gelişmiş → Gözlem'de görünür.
Yeni sürüm: dosyayı `prompts/` altına ekle, `versions` listesine yaz, `experiment.variants`'ı güncelle.

## Çevrimdışı çalışma

`HAFIZE_LOCAL_MODEL_ENABLED=true`, `HAFIZE_LOCAL_CHAT_MODEL` ve `HAFIZE_LOCAL_EMBED_MODEL` ayarlanıp
Ollama kuruluysa, NVIDIA'ya ulaşılamadığında iç model çağrıları ve embedding'ler yerel modele düşer.
Uygulama kabuğu servis çalışanıyla önbelleğe alınır.

## Anahtarlar ve yedek

- `data/master.key` (veya `HAFIZE_MASTER_KEY`) şifreli hafızanın anahtarıdır; kaybolursa hafıza okunamaz. Güvenli bir yere kopyala.
- Yedekler `HAFIZE_BACKUP_PASSPHRASE` ile şifrelenir; geri yüklemek için aynı parola gerekir.
