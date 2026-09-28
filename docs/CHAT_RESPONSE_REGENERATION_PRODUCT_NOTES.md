# Ürün Notları

## Neden
Claude-benzeri sohbet deneyiminde kullanıcı aynı soruya yeni model çıktısı istemeyi bekler.

## Tasarım ilkesi
Regeneration destructive değildir; önceki yanıt bounded history içinde kalır.

## Kullanıcı kontrolü
Sistem otomatik seçim yapmaz. Kullanıcı Yeniden üret veya Önceki yanıtı getir eylemini seçer.

## Trust
Hata halinde mevcut response korunur.

## Clarity
Generation metadata model, agent ve tools bağlamını gösterir.

## Simplicity
Yeni panel veya karmaşık ayar ekranı yerine message action row kullanılır.

## Scope
Bu özellik response generation ile sınırlıdır; model ayarlarını kalıcı olarak değiştirmez.

## Privacy
Feedback ve alternates cihazda tutulur.

## Future
Daha fazla variant yönetimi ayrı bir turda ele alınabilir.
