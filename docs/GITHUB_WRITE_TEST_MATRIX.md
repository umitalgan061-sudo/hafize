# GitHub Güvenli Yazma Test Matrisi

| Alan | Kontrol | Beklenen |
| --- | --- | --- |
| Approval | approved false | 428 |
| Approval | ticket üretimi | upstream çağrı yok |
| Approval | payload değişimi | 409 |
| Replay | aynı ticket ikinci kez | reddedilir |
| Allowlist | başka repository | 403 |
| Ref | tehlikeli branch | reddedilir |
| Path | .env/secret | 403 |
| Path | .github/workflows | 403 |
| Content | plaintext credential | 403 |
| Default | main'e file commit | 403 |
| Branch | source ref | gerçek SHA ile POST |
| File create | existingSha yok | PUT success |
| File update | existingSha var | SHA body'ye eklenir |
| PR | head=base | validation error |
| Limits | content >96 KiB | validation error |
| Limits | 1000 pending ticket | capacity error |
| Auth | unauthenticated write | AUTH_REQUIRED |
| CSRF | state-changing request | CSRF_REQUIRED |
| DOM | dynamic GitHub text | textContent |
| History | content field | saklanmaz |
| History | 12+ records | bounded |
| PWA | write CSS/JS | shell cached |
| Network | API response | no-store |
| Rollback | feature revert | workspace read unchanged |

Unit test dosyası lib/github-workspace-write.test.ts ile backend davranışları doğrulanır. Source contract testleri scripts/test-github-workspace-write-*.mjs ailesinde tutulur.
