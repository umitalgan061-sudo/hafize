# Platform Runtime Failure Modes

| Durum | Beklenen davranış | Kullanıcı etkisi | Kurtarma |
| --- | --- | --- | --- |
| localStorage erişilemez | Runtime memory-only çalışır | Metadata kalıcılığı azalır | Browser storage yeniden açılınca tekrar denenir |
| Storage estimate yok | Alanlar `null` | Dashboard alanı bilinmiyor görünür | Desteklenen API geldiğinde değerler görünür |
| PerformanceObserver yok | Observer kurulmaz | Performans detayı azalır | App çalışmaya devam eder |
| Observer entry type desteklenmiyor | Sadece o observer atlanır | Tek metrik eksik olabilir | Diğer observer'lar devam eder |
| Offline | phase degraded | Remote API kullanılamaz | Online event sonrası refresh |
| Feature start throw | feature failed | Sadece ilgili feature etkilenir | Manuel yeniden başlatma veya sonraki boot |
| Cleanup throw | Hata kaydı | Stop süreci devam eder | Error boundary izler |
| Queue full | Yeni task reddedilir | Düşük öncelikli bakım gecikir | prune + yeniden kuyruğa alma |
| Queue timeout | Task failed/cancelled | Uzun iş sonlandırılır | Abort-aware iş tasarımı |
| Dashboard DOM yok | Dashboard mount edilmez | Uygulama UI'sı çalışır | DOM uygun olduğunda sonraki boot |
| Diagnostics oversize | Minimal belge döner | Ayrıntı azalır | Son metrikler manuel incelenir |
| Capability eksik | Policy fallback | Özellik alternatif yolla kullanılır | Tarayıcı değiştirme/güncelleme |

## İlke

Platform katmanı tekil hata noktası olmamalıdır. Bir feature veya browser API'si başarısız olduğunda application core çalışmaya devam etmelidir.
