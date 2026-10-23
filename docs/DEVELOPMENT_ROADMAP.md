# Hafize Geliştirme Yol Haritası

Bu doküman 2026-10-23 tarihli geliştirme talebine göre 8 bileşenin mevcut durumunu ve uygulama planını özetler.

## 1. Güvenli Eylem Yürütme Katmanı (Skills / Actions Runtime)

Mevcut Durum:
- `lib/skills-manifest.ts` : Skill Manifest Schema, riskLevel, rollbackHint, sideEffects, requiredScopes, parameters JSONSchema destekliyor
- `lib/skills-registry.ts` : Kayıt, çözüm, agent tool intersect
- `lib/skills-runtime.ts` : Runtime, list/select/rank/resolve
- `lib/skill-consent-runtime.ts` : Kullanıcı/oturum/scope bazlı onay akışı, once/session/always/never modları
- `lib/skill-audit.ts` : Audit log, argsHash/resultHash, stage kayıtları

Eksikler / Geliştirme:
- Skill Manifest Schema'ya `sideEffects.idempotent?`, `requiredScopes[]`, `riskLevel`, `rollbackHint?` zaten var. `returns` şeması genişletilecek.
- Permission/Consent Motoru: audit log'a `userConsentId` eklenmesi, oturum başına onay akışı iyileştirme.
- Sandboxed Executor: WebAssembly/gVisor stub, timeout/memory/CPU limit sarmalayıcısı `lib/skill-sandbox-executor.ts`
- Idempotency Key Mekanizması: `resolveForAgent` çağrısında `idemKey` üretimi ve tekrar denemelerde aynı sonuç döndürme.
- Rollback / Compensating Action: riskLevel high için `rollbackSkillId` veya `compensate(args, result)` zorunluluğu runtime'da doğrulanacak.
- Observability Hooks: OpenTelemetry span'ları `skill.start`, `skill.end`, `skill.error`

Plan:
1. `lib/skill-idempotency.ts` ekle
2. `lib/skill-sandbox.ts` stub ekle
3. `skills-runtime`'a idemKey ve rollback doğrulaması ekle
4. OpenTelemetry hook'ları entegre et

## 2. Kalıcı, Kullanıcı Kontrollü Hafıza

Mevcut Durum:
- `lib/personal-memory-*` modülleri var: file adapter, persistence, encryption, runtime
- `lib/memory-consolidation.ts` var
- `lib/memory-quality.ts`, `lib/memory-retrieval-boundary.ts` var

Eksikler:
- Storage Backend Interface: `put`, `query`, `delete`, `export`, `purge` tek noktadan API
- Client-side encryption seçeneği
- İçerik Türleri: episodic/semantic/procedural ayrımı namespace bazlı
- Hybrid retrieval: dense + sparse + metadata filtre
- Namespace privacy kontrolleri
- Özetleme pipeline: günlük/haftalık otomatik konsolidasyon

Plan:
- `lib/memory-store-interface.ts` oluştur
- `lib/memory-encryption-client.ts` ekle
- Retrieval pipeline'ı `lib/memory-hybrid-retrieval.ts` olarak genişlet

## 3. Çapraz Doğruluğu Garantileyen Araştırma Ajanı

Mevcut Durum:
- `lib/web-tools.ts` var
- `lib/web-search` gibi araçlar mevcut olabilir

Eksikler:
- Multi-Source Fetcher: Google/Bing/DuckDuckGo + arXiv/PubMed/Crossref
- Content Extractor: Readability/Trafilatura
- Claim Extractor + Clusterer
- Conflict Detector
- Credibility Scorer
- Citation Generator

Plan:
- `lib/research-fetcher.ts`
- `lib/research-extractor.ts`
- `lib/research-claims.ts`
- `lib/research-credibility.ts`
- `skills/builtin.json`'a `research.run` skill'i ekle

## 4. Kendi Kendini Denetleyen Agent Loop

Mevcut Durum:
- `lib/agent-runtime.ts`, `lib/agent-delegation.ts`
- `lib/task-ledger.ts`, `lib/task-handoff.ts`
- `agents/registry.json` var

Eksikler:
- State Machine / DAG Runner tam implementasyon
- Reflection / Critic Prompt entegrasyonu
- Checkpoint / Resume DB
- Budget Guards
- Human-in-the-loop Gate
- Event Stream

Plan:
- `lib/orchestrator-dag-runner.ts`
- `lib/orchestrator-critic.ts`
- `lib/orchestrator-checkpoint.ts`

## 5. Uzman Ajan Federasyonu

Mevcut Durum:
- `agents/registry.json` Agent Card Schema var
- `lib/agent-delegation.ts` var

Eksikler:
- Registry & Discovery API
- Routing / Delegation Protocol sync+async
- Output validator JSONSchema
- Billing / Quota
- Audit Trail

Plan:
- `lib/agent-registry-server.ts`
- `lib/agent-router.ts`

## 6. Çok Modluluk

Eksikler:
- Vision Encoder API
- Diagram-as-Code Renderer
- Image Generation Bridge
- Multimodal Context Window

Plan:
- `lib/vision-encoder.ts`
- `lib/diagram-renderer.ts`

## 7. Local-First / Edge Dağıtım Paketi

Mevcut Durum:
- PWA desteği var
- Local model provider var

Eksikler:
- Model Artifacts yönetimi
- Inference Server shim
- Sync/Backup CRDT
- Auto-Update Channel

Plan:
- `lib/local-model-artifacts.ts`
- `lib/sync-engine.ts`

## 8. Geliştirici Deneyimi

Eksikler:
- Skill SDK
- Eval Harness
- Prompt/Plan Versioning
- Observability Stack
- Red-Team / Safety Test Suite

Plan:
- `scripts/skill-sdk-cli.ts`
- `scripts/eval-harness.ts`

## Öncelik

HAFIZE_RULES.md öncelik sırası korunacak. Self-development turu için 3000+ satır değişim hedefi.
İlk tur: Güvenli Eylem Yürütme Katmanı + Kalıcı Hafıza temel iyileştirmeleri.

Oluşturma tarihi: 2026-10-23
