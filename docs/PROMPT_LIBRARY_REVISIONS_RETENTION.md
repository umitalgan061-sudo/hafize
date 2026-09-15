# Revision Retention Policy

## Default

Her prompt için en fazla 10 revision saklanır. Bu sayı kullanıcı ayarı değildir; storage büyümesini öngörülebilir tutmak için ürün sınırıdır.

## FIFO davranışı

Yeni benzersiz snapshot eklendiğinde kayıtlar en yeni revision önce olacak şekilde tutulur. 10 sınırı aşılırsa en eski kayıt listeden çıkar.

## Duplicate snapshot

Başlık, body ve tags aynı olan revision yeniden eklenmez. Böylece yalnızca editor açılması storage büyümesine yol açmaz.

## Prompt sayısı

Revision map en fazla 120 prompt id'si işler. Bu sınır Prompt Library ana kayıt limitiyle hizalıdır.

## Clear

Bir prompt history temizlendiğinde yalnız o prompt'un revision dizisi kaldırılır. Diğer prompt revision'ları etkilenmez.

## Export

Retention export dosyasında korunur; export mevcut 10 revision sınırını genişletmez.

## Restore

Restore öncesindeki mevcut içerik manual snapshot olarak retention listesine girer. Gerekirse bu işlem en eski automatic snapshot'ın dışarı çıkmasına neden olabilir.

## Privacy

Retention kullanıcı verisini sunucuya göndermez. Storage süresi tarayıcı profilinin yaşam döngüsüne bağlıdır.

## Upgrade

Retention sınırı gelecekte azaltılırsa migration yalnız fazla eski kayıtları yerel olarak temizler; ana prompt kayıtlarına dokunmaz.
