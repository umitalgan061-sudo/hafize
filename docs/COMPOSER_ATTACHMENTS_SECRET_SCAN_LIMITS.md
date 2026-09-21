# Composer Ekleri — Secret Scan Sınırları

## Scan budget
Scanner yalnız ilk 80.000 karakteri tarar ve en fazla 12 finding üretir.

## Pattern classes
Private key marker, token prefix, cloud key prefix, JWT ve credential assignment.

## Warning
Riskli kayıt satırında kısa finding özeti gösterilir.

## Confirmation
Seçilen riskli attachment Mesaja ekle veya hızlı analiz ile composer'a taşınmadan önce kullanıcıdan açık onay ister.

## No echo
Scanner secret değerinin tamamını UI'a yazmaz; yalnız pattern sınıfının adını bildirir.

## False positives
Regex tabanlı tarama tam DLP değildir. Kullanıcıya güvenlik garantisi vermez.

## Privacy
Finding listesi storage veya telemetry'ye yazılmaz.