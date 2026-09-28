# Tehdit Modeli

## Varlıklar
Conversation content, assistant alternate responses, feedback state ve generation metadata.

## Tehditler
XSS, accidental data leakage, repeated requests, local storage corruption, UI race ve rollback failure.

## Mitigations
DOM output textContent ile sınırlı. Request concurrency isStreaming ile bounded. Alternates capped.

## Leakage
Alternates request message listesine dahil edilmez. Connector API'lerine gönderilmez.

## Race
Regeneration sırasında action buttons disabled olur ve ikinci generation engellenir.

## Corruption
Normalization invalid fields'i atar.

## Failure
Response rollback mevcut content'i memory'de tutar.

## Availability
Clipboard gibi optional capability başarısız olduğunda chat çalışmaya devam eder.

## Residual
Local storage erişimi kullanıcı cihazındaki diğer scriptler için browser güvenlik modeline tabidir.
