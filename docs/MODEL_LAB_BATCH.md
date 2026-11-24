# NVIDIA Model Laboratuvarı — toplu test ve yönlendirme

Yalnız doğrulanmış hesap sahibi, doğrudan NVIDIA API bağlantısında bu sohbet komutlarını kullanabilir:

- `Model laboratuvarı`: gerçek katalog ve son test durumları.
- `NVIDIA modellerini listele`: API'nin model listesini alır (listede bulunmak erişim veya ücretsiz kullanım kanıtı değildir).
- `Model testi: yayıncı/model`: izinli adayın kısa sentetik testi.
- `NVIDIA model testlerini başlat` veya `Model testlerine devam et`: en fazla iki güncel testi olmayan adayı sırayla ölçer. Arka plan çalışması başlatmaz.

Bir test en fazla iki API isteği yapar; on dakikada en fazla 12 laboratuvar isteği. 401, 402, 429 yanıtlarında laboratuvar bekler ve Retry-After değerini sınırlı biçimde dikkate alır. Başarılı testler 24 saat, geçici sorunlar daha kısa süre önbelleğe alınır; süreç yeniden başlarsa bellek sıfırlanır. Adaylar yalnız sunucu yapılandırmasından gelir. Kullanıcı sohbet verisi, anahtarlar veya gerçek araç işlemleri test istemlerine eklenmez.

Laguna XS 2.1 ve GLM 5.3 Flash yalnız güncel başarılı sentetik sonuçları görev kategorisine uygunsa mevcut zincirin önüne alınır. Araç kullanan görevler araç çağırma testini geçmelidir. Ölçülmemiş ek adaylar yedek zincire eklenmez. Mevcut ana zincir ve özel amaçlı modeller korunur. Bu basit testler genel zekâ, güvenlik, kod doğruluğu veya üretim erişimi garantisi değildir; kalıcı benchmark deposu, ücretli partner, GPU kurulumu ve multimodal testler bu sürüm kapsamı dışındadır.

Geri dönüş: PR revert. Ek model yönlendirmesi test kanıtı süresi dolduğunda kendiliğinden durur.

## V2
- `Model derin testi: yayıncı/model`: önce normal test gerekir; en fazla iki ek sentetik istek, Türkçe yazım, aritmetik, Python çıktısı ve sahte araç sonucunu yorumlama. Gerçek araç çağrısı yoktur. Aynı 12 istek / 10 dakika bütçesini kullanır.
- Görev kategorileri: genel, hızlı, akıl yürütme, kodlama, ajan ve hızlı/akıl yürütmeli ajan. Türkçe ekler ve metin parçaları sınıflandırılır. Test edilmiş ek adaylar kategori uyumuna göre öne çıkar; temel zincir korunur.
- `HAFIZE_MODEL_LAB_CANDIDATES`: isteğe bağlı virgülle ayrılmış operatör onaylı sohbet modeli kimlikleri; mevcut zincirle birlikte en fazla 30 test adayı. NVIDIA kataloğundan otomatik ücretli erişim açılmaz; operatör ücretsiz erişim koşullarını doğrulamalıdır.
- Sonuçlar halen süreç belleğindedir; kalıcı disk/DB veya multimodal benchmark bu değişikliğin kapsamı dışındadır. Ölçümler küçük sentetik örneklerdir.

## V2 — isteğe bağlı test deposu ve özel amaçlı modeller
`HAFIZE_MODEL_LAB_STORAGE_PATH` ayarlanırsa tek süreçli sunucuda sentetik sonuçlar ve istek bütçesi atomik dosya yazımıyla saklanır. Yol mutlak olmalı, üst dizin önceden oluşturulmalı ve yalnız operatör tarafından yönetilmelidir. Anahtar değişince eski sonuçlar kullanılmaz; ham anahtar kaydedilmez. Dosya hatası durum ekranında görülür ve süreç belleği kullanılır. Render ücretsiz geçici dosya sistemi kalıcılık garantisi vermez; kalıcı birim olmadan yeniden dağıtımlarda veri kaybı mümkündür. Çok örnekli dağıtımda ortak atomik bütçe için bir DB gerekir. Görsel, ses, belge ve diğer özel amaçlı girdiler genel sohbet yönlendirmesinden korunur; bu yeni multimodal entegrasyon değildir.
