# Gizlilik Merkezi Operasyon Runbook

## Kontrol

Panel açılmıyorsa Settings Workspace'in `settingsWorkspace` kimliğini ve index asset yüklemesini kontrol et.

## Storage

Beklenmeyen yüksek byte değeri varsa önce inventory sonucu ile yüzey bazında hangi alanların bulunduğunu incele. İçeriği loglama.

## Temizleme sorunu

`ok=false` dönen temizleme işlemlerinde storage erişim veya tarayıcı kotası problemi varsay. Aynı işlemi otomatik tekrar tekrar çalıştırma.

## Rapor sorunu

Blob oluşturulamıyorsa kullanıcıya raporun oluşturulamadığını bildir. Storage verisini sunucuya gönderen alternatif yol kullanma.

## PWA

Service Worker cache sürümü güncellenmiş olmalı. Yeni asset index.html ve sw-policy içinde aynı path ile bulunmalıdır.

## Destek

Kullanıcıya hangi yüzeyin neyi içerdiği dokümantasyondaki açıklamalarla anlatılmalıdır; ham localStorage değeri istenmemelidir.

## Geri dönüş

Panel UI sorunlarında settings-privacy asset'i revert edilebilir. Persistent storage anahtarlarını otomatik silen bir rollback uygulanmamalıdır.

## Gözlem

Değişiklikler yalnız cihaz içi event'lerle izlenir. Analytics veya telemetry eklenmesi bu özelliğin güvenlik sözleşmesini değiştirir ve ayrı tasarım gerektirir.
