# GitHub çalışma alanı rollback

## Amaç

Rollback yalnız GitHub workspace katmanını devreden çıkarmalıdır. Prompt Library, conversation history ve scheduled tasks storage alanlarına dokunulmaz.

## Geri alma

Workspace route, UI entrypoint, CSS, reader ve associated test/doc commits birlikte revert edilir.

## PWA

Eski service worker cache version'ına dönüldüğünde yeni GitHub workspace asset'leri shell listesinden çıkarılır.

## Browser

Kullanıcı oturumundaki repository history sessionStorage'da kalabilir; bu güvenlik açısından token içermez.

## Veri bütünlüğü

GitHub üzerinde herhangi bir write işlemi bu çalışma alanında yapılmadığı için rollback'in remote repository etkisi yoktur.

## Son kontrol

Main yeniden deploy edildikten sonra /api/github/workspace route'unun eski olmayan bir 404 veya güvenlik politikasına uygun davranması ve ana sohbetin sağlıklı kalması doğrulanmalıdır.
