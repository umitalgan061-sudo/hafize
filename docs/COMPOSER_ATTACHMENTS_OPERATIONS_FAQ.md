# Composer Ekleri — Operasyon SSS

### Cache neden v37?
Attachment static assetleri shell cache'e dahil edildiği için.

### Dosya içeriği cache'de neden yok?
Kullanıcı içeriğinin service worker katmanında kalıcılaşmaması için.

### Secret scanner neden local?
Credential taraması için dosya içeriğini server'a taşımadan uyarı üretmek için.

### Neden 4 dosya?
UI ve memory bütçesini bounded tutmak için.

### Neden range?
Kaynak dosyanın yalnız ilgili bölümünü modele göndermeyi kolaylaştırmak için.

### Neden undo şart?
Cursor insertion sırasında kullanıcı hatasını düşük maliyetle geri almak için.

### Neden otomatik submit yok?
Dosya içeriğinin gönderilmesi açık kullanıcı kararı olarak kalmalıdır.