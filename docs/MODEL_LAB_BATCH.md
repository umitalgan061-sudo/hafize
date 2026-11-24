# NVIDIA Model Laboratuvarı — toplu test ve yönlendirme

Yalnız doğrulanmış hesap sahibi, doğrudan NVIDIA API bağlantısında bu sohbet komutlarını kullanabilir:

- `Model laboratuvarı`: gerçek katalog ve son test durumları.
- `NVIDIA modellerini listele`: API'nin model listesini alır (listede bulunmak erişim veya ücretsiz kullanım kanıtı değildir).
- `Model testi: yayıncı/model`: izinli adayın kısa sentetik testi.
- `NVIDIA model testlerini başlat` veya `Model testlerine devam et`: en fazla iki güncel testi olmayan adayı sırayla ölçer. Arka plan çalışması başlatmaz.

Bir test en fazla iki API isteği yapar; on dakikada en fazla 12 laboratuvar isteği. 401, 402, 429 yanıtlarında laboratuvar bekler ve Retry-After değerini sınırlı biçimde dikkate alır. Başarılı testler 24 saat, geçici sorunlar daha kısa süre önbelleğe alınır; süreç yeniden başlarsa bellek sıfırlanır. Adaylar yalnız sunucu yapılandırmasından gelir. Kullanıcı sohbet verisi, anahtarlar veya gerçek araç işlemleri test istemlerine eklenmez.

Laguna XS 2.1 ve GLM 5.3 Flash yalnız güncel başarılı sentetik sonuçları görev kategorisine uygunsa mevcut zincirin önüne alınır. Araç kullanan görevler araç çağırma testini geçmelidir. Ölçülmemiş ek adaylar yedek zincire eklenmez. Mevcut ana zincir ve özel amaçlı modeller korunur. Bu basit testler genel zekâ, güvenlik, kod doğruluğu veya üretim erişimi garantisi değildir; kalıcı benchmark deposu, ücretli partner, GPU kurulumu ve multimodal testler bu sürüm kapsamı dışındadır.

Geri dönüş: PR revert. Ek model yönlendirmesi test kanıtı süresi dolduğunda kendiliğinden durur.
