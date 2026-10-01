# TypeScript Readiness Migration Wave

Bu dalga readiness ve schedule-leasing sınırlarını gerçek TypeScript kaynaklarına taşıyarak legacy uygulama kodunu azaltır.

## Taşınan production kaynakları

- config-readiness
- deployment-readiness
- runtime-readiness
- pwa-readiness
- release-manifest
- system-readiness
- encrypted-schedule-config
- schedule-lease-runtime-config
- schedule-execution-lease

Her domain için TS dosyası kanonik davranış kaynağıdır. MJS dosyası yalnız export bridge olarak korunur.

## Test stratejisi

Readiness ve schedule testleri de TypeScript'e taşındı. Eski test isimleri ince MJS bridge olarak bırakılır; gerçek test mantığı TS kaynaklarında bulunur.

tsconfig içine scripts TS kapsamı eklendi. Böylece migration yalnız runtime'da değil, test kaynaklarında da typecheck edilir.

## Health entegrasyonu

buildSystemReadiness mevcut güvenli health bilgilerinden birleşik bir rapor üretir. Health response içine secret, token, credential veya ham environment değeri eklenmez.

## Schedule güvenliği

Schedule lease boundary; holder ID, schedule ID, fence, lease TTL, provider timeout ve provider response durumlarını normalize eder.

Provider hataları dışarıya internal bağlantı bilgisi taşımayan bounded hata kodlarıyla çıkar.

## Geriye dönük uyumluluk

Legacy MJS yolları kaldırılmadı; bridge biçiminde tutuldu. Bu, tüketicileri tek hamlede kırmadan aşamalı migration yapılmasına izin verir.

## Sonraki dalgalar

Kalan büyük production MJS implementasyonları ayrı bounded turlarda taşınmalıdır. Büyük memory, device-action ve schedule adapter modülleri kendi davranış ve test bütçeleriyle ele alınmalıdır.
