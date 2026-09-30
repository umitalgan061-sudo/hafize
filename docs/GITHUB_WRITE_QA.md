# GitHub Güvenli Yazma QA

## Fonksiyonel
- Branch doğru source SHA ile oluşturulur.
- Default branch'e doğrudan commit reddedilir.
- Yeni file commit base64 body ile gider.
- Existing SHA güncelleme isteğine eklenir.
- PR head/base/title/body doğru normalize edilir.
- Kullanıcı onayı olmadan write çağrısı çalışmaz.
- Ticket ikinci kez kullanılamaz.

## Güvenlik
- Read ve write allowlist ayrı çalışır.
- Secret-like path'ler reddedilir.
- .github/workflows reddedilir.
- Plaintext credential içerikleri reddedilir.
- Upstream response body browser'a taşınmaz.
- Browser source token veya Authorization içermez.
- POST route'ları session + CSRF guard arkasındadır.

## UI
- Önizleme yazma öncesinde görünür.
- Checkbox olmadan action disabled'dır.
- Result alanı text node üretir.
- GitHub URL'leri güvenli pattern ile açılır.
- History en fazla 12 kayıt tutar ve content saklamaz.
- Mobile, forced-colors ve reduced-motion stilleri korunur.

## Regression
Kaynak sözleşmesi testleri ve Vitest unit suite release gate'in parçasıdır.
