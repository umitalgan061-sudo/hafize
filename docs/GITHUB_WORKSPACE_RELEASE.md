# GitHub çalışma alanı release checklist

## Kaynaklar

github-workspace.ts, github-workspace-extra.ts ve github-workspace-details.ts yalnız GET ve bounded output kullanır.

## Server

server.ts üç temel workspace route'u, directory, compare, commit ve pull detail route'larını doğru reader'lara bağlamalıdır.

## Auth

production-guard.ts bütün workspace route'larını protectedPath listesinde tutmalıdır.

## Browser

index.html yeni CSS ve typed-build entrypoint'lerini yüklemelidir. Vite development replacement ve build entry aynı isimleri kullanmalıdır.

## PWA

sw-policy.js yeni CSS/JS asset'lerini shell listesine eklemeli ve API route'larını cache dışı bırakmalıdır.

## Testler

Vitest reader testleri ve scripts/test-github-workspace-* kaynak testleri çalıştırılır.

## Manuel smoke

Allowlistte bir repository ile repo, branch, commit, PR, file, directory ve compare akışları denenir.

## Security smoke

Allowlist dışı repo, traversal path, secret dosya, credential içerik ve write method senaryoları kontrol edilir.

## Rollback

Release sonrası kritik regresyonda yalnız workspace commit'leri revert edilir. Diğer çalışma alanı storage'ları korunur.

## PR

PR açıklaması değişiklik, gerekçe, test sonucu ve rollback yolunu içermelidir. Diff başlangıç base'i ile son head arasında ölçülmelidir.
