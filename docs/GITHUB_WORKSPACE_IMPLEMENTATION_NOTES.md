# GitHub çalışma alanı implementation notes

## Reader ayrımı

github-workspace.ts temel repository, branch, commit, PR ve file işlemlerini normalize eder. github-workspace-extra.ts directory ve compare uçlarını ayrı tutar. github-workspace-details.ts commit ve PR detayını ayrı normalize eder.

Bu ayrım her katmanın hata sözleşmesini küçük tutar ve future write surface ile karışmasını engeller.

## Server wiring

server.ts her reader için ayrı handler kullanır. Genel workspace endpoint'i action parametresi taşır. Directory ve compare ayrı endpoint'lerdir. Commit ve PR detail uçları da ayrı tutulur.

Production guard bütün bu yolları protectedPath içinde kapsar.

## Build wiring

Vite development transform typed-build yollarını typed source dosyalarına çevirir. Production build her workspace module için ayrı ES bundle üretir.

Index.html CSS ve typed JS asset'lerini açıkça yükler.

## PWA wiring

sw-policy.js workspace CSS ve JS bundle'larını shell asset listesinde tutar. API path'leri startsWith('/api/') nedeniyle network-only sınıfında kalır.

Duplicate asset kaydı bulunmamalıdır.

## State model

Core state repository/ref/path için sessionStorage kullanır. Quick action history ayrı bir bounded sessionStorage key'idir.

State hiçbir zaman GitHub token saklamaz.

## DTO sınırları

Repository metadata, branch, commit, PR, directory ve compare response'ları bounded alanlardan oluşturulur. Full upstream response browser'a doğrudan geçirilmez.

Commit ve PR body/message alanları sınırlanır.

## UI güvenliği

Dinamik uzak metin textContent ile render edilir. Dosya içeriği pre text node olarak gösterilir. HTML yorumlanmaz.

GitHub linkleri yalnız güvenli github.com HTTPS URL'leri için oluşturulur.

## Error mapping

Known backend error code'ları UI tarafından kullanıcı mesajlarına çevrilir. Unknown exception yalnız genel workspace failure olarak gösterilir.

Upstream response body error mesajına eklenmez.

## Read-only boundary

Reader fetch katmanında GET kullanır. Browser enhancement katmanı da GET ile sınırlıdır. UI'da write control bulunmaz.

## Future extension

Write işlemleri eklenecekse bu reader'lara method eklemek yerine bağımsız bir approval-boundary tasarlanmalıdır. Mevcut workspace'ın read-only güvenlik sözleşmesi gevşetilmemelidir.

## Review checklist

Reader importleri geçerli mi: evet.
Allowlist kontrolü her aksiyonda mı: evet.
Path ve ref bounds uygulanıyor mu: evet.
Production auth route'ları kapsıyor mu: evet.
PWA asset listesi güncel mi: evet.
Browser token yok mu: evet.
Write method yok mu: evet.
Result rendering XSS-safe mi: evet.
Rollback storage bağımsız mı: evet.

## DoD

Fonksiyonel okuma, güvenlik sınırları, PWA wiring, accessibility, test coverage ve rollback dokümantasyonu aynı turda korunur.
