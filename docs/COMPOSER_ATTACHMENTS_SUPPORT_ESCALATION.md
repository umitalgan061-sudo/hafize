# Composer Ekleri — Support Escalation

## Seviye 1
Uzantı, dosya boyutu, boş dosya ve composer kapasitesi kontrol edilir.

## Seviye 2
Browser ailesi, drag-drop ve clipboard capability kontrol edilir.

## Seviye 3
Network logunda dosya seçiminde request olup olmadığı incelenir. Attachment runtime'ında network sink aranır.

## Seviye 4
Secret warning, range clamp, undo ve lifecycle regression testleri çalıştırılır.

## Kullanıcıdan istenecek bilgi
Browser adı/sürümü, dosya uzantısı, yaklaşık boyut ve görünen status mesajı yeterlidir.

Dosyanın kendisini veya gizli içeriğini support kanalına yüklemek istenmez.

## Escalation criteria
Tekrarlanabilir security regression, accidental submit, user-content persistence veya service-worker leakage bulguları doğrudan geliştirici güvenlik incelemesine çıkar.