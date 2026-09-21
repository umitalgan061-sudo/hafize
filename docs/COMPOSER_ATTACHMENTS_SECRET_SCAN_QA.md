# Composer Ekleri — Secret Scanner QA

## Pozitif örnekler
Private key marker, GitHub token, AWS access key, Google key, Slack token, JWT ve credential assignment örnekleri uyarı üretmelidir.

## Negatif örnekler
Aynı kelimelerin açıklama metninde tek başına bulunması risk olarak yorumlanmamalıdır. Tespit desenleri gerçek credential yapısına daha yakındır.

## Onay akışı
Riskli dosya seç → Mesaja ekle → confirm dialog → Cancel ise textarea değişmesin → OK ise insert gerçekleşsin.

## No-submit
Risk onayı tek başına form gönderimi oluşturamaz.

## DOM
Finding summary textContent üzerinden gösterilir. Dosyanın hassas içeriği status alanında tekrar edilmez.

## Limit
Scanner maksimum 80.000 karakter tarar ve 12 bulguda durur. Bu sınırlar regression testiyle korunur.

## Regression
Scanner modülü Prompt Library, Composer History veya schedule storage kullanmamalıdır.