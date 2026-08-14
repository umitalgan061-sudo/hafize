# Hafize ekran analizi production sınırı

Bu özellik yalnız kullanıcının seçtiği tek bir ekran karesini, ayrıca **Hafize ile analiz et** düğmesine basması üzerine NVIDIA vision modeline gönderir.

## Güvenlik modeli

- Ekran yakalama browser `getDisplayMedia` izniyle başlar; gizli veya arka plan capture yoktur.
- Capture sonrası görüntü yalnız sekme belleğinde tutulur ve kullanıcı analiz düğmesine basana kadar backend'e gönderilmez.
- İstek `explicitUserIntent:true`, seçili NVIDIA modeli, kısa kullanıcı prompt'u ve tek JPEG data URL dışında alan kabul etmez.
- Görüntü ve prompt model açısından veri kabul edilir; system talimatına dönüşmez.
- Screen-analysis payload'ında tool veya tool-choice yoktur; agent/tool izin sistemi bu yol üzerinden atlanamaz.
- Sonuç personal memory, scheduler veya sohbet geçmişine otomatik yazılmaz.
- Capture kaldırılırsa veya sayfa kapanırsa devam eden analysis isteği abort edilir.

## Body limitleri

Normal chat ve diğer JSON endpoint'leri mevcut `256 KiB` global limitini korur. Screen analysis için ayrı server runtime `1536 KiB` üst sınırı kullanır; bu yalnız en fazla `1 MiB` JPEG'in base64 + JSON taşıma maliyetini karşılamak içindir. 2 MiB üzerinde yapılandırma kabul edilmez.

## Public yüzey

`GET /api/health` yalnız `screenAnalysisConfigured:boolean` yayınlar. API key, model credential, image byte metadata veya upstream hata detayı dönmez.

`POST /api/screen-analysis` başarılı olduğunda yalnız `{content, model}` döner. Provider hataları sanitize edilir ve görüntü response'a geri yansıtılmaz.

## Kalıcılık

Frontend analizi `localStorage`, `sessionStorage` veya `indexedDB`'ye yazmaz. Kullanıcı ekran görüntüsünü kaldırdığında preview ve analysis state temizlenir. Kalıcı kayıt istenirse bunun ayrı, açık kullanıcı kontrollü bir memory işlemi olması gerekir.
