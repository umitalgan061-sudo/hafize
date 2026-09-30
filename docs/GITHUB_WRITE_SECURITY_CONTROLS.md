# GitHub Güvenli Yazma Kontrol Listesi

## Kimlik
- Application session gerekli.
- State-changing çağrıda CSRF başlığı gerekli.
- Connector bearer principal write route'larına erişemez.
- GitHub token yalnız server process içinde tutulur.

## Yetki
- HAFIZE_GITHUB_WRITE_REPOS ayrı allowlist'tir.
- Repository kararı server-side verilir.
- Kullanıcıdan gelen repository değeri wildcard olarak yorumlanmaz.

## Onay
- Approval checkbox UI'da zorunludur.
- Server approved flag'i ayrıca kontrol eder.
- Ticket action ve payload fingerprint'e bağlıdır.
- Ticket tüketilince memory Map'ten çıkarılır.
- Expired ticket purge edilir.

## Veri
- Content bounded ve credential policy'den geçer.
- Path traversal reddedilir.
- Secret/private-key path'leri reddedilir.
- Workflow path'leri reddedilir.
- Raw upstream response client'a taşınmaz.

## Git governance
- Default branch direct commit reddedilir.
- Existing SHA file update için kullanılır.
- PR oluşturma merge işlemi değildir.
- Destructive delete capability'si yoktur.

## Browser storage
- History sessionStorage kullanır.
- Approval ticket saklanmaz.
- File content history'ye yazılmaz.
- Token veya Authorization history'ye yazılmaz.
