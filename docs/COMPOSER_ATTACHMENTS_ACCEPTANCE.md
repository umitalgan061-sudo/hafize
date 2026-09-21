# Composer Ekleri — Acceptance Criteria

## Kullanıcı deneyimi
Dosya ekle düğmesi paneli açar. Kullanıcı dosya seçebilir, drop yapabilir veya destekliyorsa clipboard file yapıştırabilir.

Her kayıt görünür dosya adı, boyut, dil, karakter ve satır bilgisine sahiptir.

Kullanıcı checkbox ile insert kapsamını belirler. Range ile bölüm seçebilir. Preview ile bölümün içeriğini inceleyebilir.

Insert imleç veya textarea selection konumunu kullanır ve son insert geri alınabilir.

## Güvenlik
256 KB üstü dosya read başlamadan reddedilir. Attachment content persistence ve network yoktur. DOM unsafe sink kullanılmaz.

Bilinen secret desenlerinde uyarı görünür ve mesaja ekleme açık confirmation gerektirir.

## Gönderim
Insert işlemi hiçbir durumda otomatik submit yapmaz.

## Erişilebilirlik
Panel klavyeyle açılıp kapanır, Escape focus geri verir ve status mesajları canlı olarak duyurulur.

## PWA
Üç ana asset ve secret scanner shell cache'de bulunur.

## Backward compatibility
Mevcut Prompt Library, Composer History ve conversation storage formatları değiştirilmez.

## Rollback
Özellik tümüyle ayrı UI varlıkları ve wiring üzerinden geri alınabilir.