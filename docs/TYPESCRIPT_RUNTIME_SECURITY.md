# TypeScript runtime security

## Credential güvenliği

Server secret'ları TypeScript modüllerinde environment üzerinden alınır ve client bundle'a taşınmaz.

Session secret ve bearer credential karşılaştırmaları timing-safe primitive kullanır. Credential length sınırları normalize edilmeden önce uygulanır.

## Request boundary

Production guard public runtime için auth, state-changing requestlerde CSRF, chat ve agent concurrency limiti, API rate-limit ve login rate-limit uygular.

## Tool boundary

Ajan policy deny-by-default'tur. Sensitive permission explicit olarak verilmezse çalışmaz. Tool call önce normalize edilir, sonra authorization kontrolünden geçer.

## Result boundary

Tool result prototype, accessor, object graph depth, node count, string size ve plaintext credential kontrollerinden geçer.

## Delegation

Delegated agent parent trace/task ilişkisi içinde çalışır. Depth ve fan-out registry policy ile sınırlandırılır.

## Schedule

Scheduled task ownership principal subject ile doğrulanır. Lease executor fence ve deduplication ile aynı işin iki worker tarafından tamamlanmasını sınırlar.

## Observability

Security event logger route ve outcome gibi düşük hassasiyetli metadata üretir. Authorization, cookie, token, secret ve password anahtarları metadata'dan filtrelenir.

## Tehdit yüzeyi

1. malformed external input
2. credential leakage through tool results
3. unauthorized agent/tool escalation
4. duplicated scheduled execution
5. streaming connection aborts

Typed boundaries bu yüzeylerde runtime validation ile savunma derinliği sağlar.
