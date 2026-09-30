# GitHub Güvenli Yazma API Sözleşmesi

## Kimlik ve HTTP
Tüm endpoint'ler same-origin uygulama session'ı ile korunur. State-changing çağrılarda production guard CSRF başlığını zorunlu kılar. Browser GitHub token'ını hiç görmez.

Endpoint'ler:
- POST /api/github/workspace/write/approval
- POST /api/github/workspace/write

Approval isteğinde action, approved ve payload bulunur. approved true değilse 428 döner. Başarılı cevap action, repository, expire zamanı ve rastgele ticket verir.

Write isteğinde action, ticket ve aynı payload bulunur. Ticket tek kullanımlıktır. Action, repository veya payload fingerprint değişirse 409 döner.

## Branch
Payload: repository, branch, fromRef. fromRef bir branch/ref veya 40 karakter SHA olabilir. Sunucu gerçek SHA'yı resolve eder ve GitHub git refs endpoint'ine POST yapar.

## File
Payload: repository, branch, path, message, content ve isteğe bağlı existingSha. Varsayılan branch doğrudan hedef olarak kullanılamaz. existingSha verilirse PUT isteğine dahil edilir.

## Pull request
Payload: repository, head, base, title, body, draft. Head ve base aynı olamaz. Cevap yalnız PR numarası, başlık, branch bilgisi ve güvenli GitHub URL'siyle normalize edilir.

## Replay
Ticket fingerprint'e bağlıdır ve ilk tüketimde Map'ten silinir. Süre iki dakikadır; bekleyen ticket sayısı 1000 ile sınırlandırılmıştır.
