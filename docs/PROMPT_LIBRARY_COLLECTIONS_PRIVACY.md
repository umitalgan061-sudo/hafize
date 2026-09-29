# Koleksiyon Gizlilik Modeli

Koleksiyon verileri cihaz içi kişisel veridir.

Saklanan içerik koleksiyon adı, koleksiyon metadata'sı ve prompt ID ile koleksiyon ID arasındaki ilişkidir.

Prompt gövdesi bu modülde tekrar saklanmaz. Mevcut prompt library storage kaydı kaynak olarak kullanılır.

Koleksiyon kullanım sayıları ayrıca tutulmaz. Görünen sayaçlar mevcut prompt kayıtlarından hesaplanır.

Koleksiyon export'u kullanıcının açık indirme eylemi ile başlar.

Import kullanıcı seçtiği dosyayı okur; dosya içeriği dış servise gönderilmez.

Silme işlemi tek koleksiyonu kaldırır. Atanan prompt kayıtlarının metni, favori durumu, etiketleri ve kullanım sayıları korunur.

Rollback sırasında koleksiyon modülü kaldırılırsa prompt library çalışmaya devam eder. Koleksiyon anahtarlarının cihazda kalması fonksiyon kaybı yaratmaz.

Tarayıcı profili temizlendiğinde collection storage da temizlenebilir. Uygulama bunu geri getiremez; bu nedenle yedekleme belgeleri export akışını açıkça tarif eder.

Yerel storage paylaşımı aynı origin kapsamındadır. Başka origin'lere veri aktarımı yapılmaz.

Gizlilik incelemesinde temel soru şudur: koleksiyon özelliği prompt içeriğini yeni bir backend yüzeyine taşımamalıdır.

Bu nedenle implementation yalnızca DOM, localStorage, FileReader, Blob ve object URL API'leri ile sınırlıdır.
