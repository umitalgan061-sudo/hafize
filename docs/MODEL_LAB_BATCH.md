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
- Sonuçlar varsayılan olarak süreç belleğindedir; isteğe bağlı dosya deposu aşağıda açıklanmıştır. Çok örnekli ortak DB veya multimodal benchmark kapsam dışındadır. Ölçümler küçük sentetik örneklerdir.

## V2 — isteğe bağlı test deposu ve özel amaçlı modeller
`HAFIZE_MODEL_LAB_STORAGE_PATH` ayarlanırsa tek süreçli sunucuda sentetik sonuçlar ve istek bütçesi atomik dosya yazımıyla saklanır. Yol mutlak olmalı, üst dizin önceden oluşturulmalı ve yalnız operatör tarafından yönetilmelidir. Anahtar değişince eski sonuçlar kullanılmaz; ham anahtar kaydedilmez. Dosya hatası durum ekranında görülür ve süreç belleği kullanılır. Render ücretsiz geçici dosya sistemi kalıcılık garantisi vermez; kalıcı birim olmadan yeniden dağıtımlarda veri kaybı mümkündür. Çok örnekli dağıtımda ortak atomik bütçe için bir DB gerekir. Görsel, ses, belge ve diğer özel amaçlı girdiler genel sohbet yönlendirmesinden korunur; bu yeni multimodal entegrasyon değildir.

Eşzamanlı sohbetlerde bozuk stream, son kullanılan global modele değil yalnız o yanıtı üreten modele uygulanır. Stream kullanım telemetrisi mümkün olduğunda gerçek yönlendirilmiş model kimliğini gösterir.

## V3 — katalog ve model konseyi
- `Model kataloğu`: katalog, aday yapılandırması, tahmini yetenek ailesi ve güncel gözlemleri tablo halinde gösterir. Fiyat bilinmiyor; hiçbir katalog modeli otomatik eklenmez.
- `Model konseyi: soru`: güncel sohbet testi olan iki farklı model aynı açık kullanıcı sorusunu bağımsız yanıtlar; bütçe ve üçüncü aday varsa üçüncü model kısa karşılaştırma yazar. En fazla üç istek, mevcut 12/10 dakika bütçesinde. Araçlar kapalıdır. Sorular ve yanıtlar test deposuna yazılmaz. Dış kaynak doğrulaması değildir. Model çıktıları normal sohbet çıktısıdır ve yürütülmez.
- Belge, görüntü, ses, embedding, rerank ve güvenlik kategorileri sadece katalog aday türleridir; erişim testi veya çalışan üretim adaptörü anlamına gelmez.

- `Embedding testi: nvidia/nemotron-3-embed-1b` mevcut embedding modelini üç sentetik cümle ile tek istekte ölçer. Boyut, geçerli sayısal vektör ve basit benzerlik kontrolü; genel retrieval kalitesi değildir. `HAFIZE_MODEL_LAB_EMBEDDINGS` operatörün erişim/maliyetini onayladığı Nemotron 3/3.5 embedding kimliklerini seçer. Sonuçlar bu sürümde geçici bellektedir, otomatik üretim model değişikliği yoktur. Resmi API: https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-embed-1b-infer .
- Üretim embedding önbelleği artık model, sağlayıcı, input_type ve gönderilen metinle ayrılır; NVIDIA ve yerel model vektörleri tek batch içinde karıştırılmaz. Hatalı, sıfır veya farklı boyutlu vektörler reddedilir.

## V3 — Ayarlar paneli
Ayarlar > NVIDIA Model Laboratuvarı: durum, katalog arama, görev liderleri, model seçimi, sohbet/derin/embedding ve toplu test düğmeleri. İlk açılışta otomatik API isteği yoktur; düğmeler kullanıcı tarafından çalıştırılır. `/api/models/status/lab` GET/POST uçları mevcut oturum, CSRF ve sahibi doğrulama sınırını kullanır. Konsey soruları bu test HTTP uç noktasına kabul edilmez.

- Hafıza veritabanındaki şifreli vektörler model kimliğiyle eşleştirilir. Boyutları aynı olsa bile farklı embedding modellerinin vektörleri karşılaştırılmaz; eski model kayıtlarında BM25 araması kullanılabilir. Konseyde bir model veya üçüncü değerlendirici ağ hatası verirse başarılı yanıtlar korunur.

## V4 — günlük iyileştirme
Sunucu açıldığında ve 15 dakikada bir 24 saatlik pencere kontrol edilir. SQLite kaydı aynı pencereyi ikinci kez çalıştırmayı engeller (aynı kalıcı DB için). Varsayılan günlük denetim bütün uzman ajanların sağlık, kota ve performansını değerlendirir; uzman seçiminde alakasız, sağlıksız veya kotası bitmiş adaylar elenir. `HAFIZE_DAILY_LIVE_PROBES=true` yalnız ücretsiz erişim doğrulanmışsa etkinleştirilir: mevcut bütçeyle iki sohbet adayı ve bir embedding adayını ölçer, başarılı güncel sonuçlar model tercihlerini günceller. Bu ağırlık eğitimi veya kendi kaynak kodunu değiştirip deploy etme değildir. Render ücretsiz uyku/ephemeral disk nedeniyle kesin zaman veya kalıcılık garanti edilmez. Günlük durum sahibi panelinde görünür. `HAFIZE_DAILY_IMPROVEMENT=false` döngüyü durdurur.

- Tüm 12 uzman ajan için sunucu tarafından verilen görev profili eklendi; model kimliği/ajan profili istemciden serbestçe kabul edilmez. Uzman görevlerine özel kalite kriterleri eklenirken araç izinleri ve mevcut çıktı sözleşmeleri değişmedi. GitHub kalite iş akışı ayrıca her gün 00:17 UTC (Türkiye 03:17) planlanır; GitHub yoğunluğu veya plan limitleri nedeniyle gecikebilir. Bu iş akışı model ağırlığı eğitmez, kaynak koduna otomatik yazmaz ve ücretli model çağrısı yapmaz.

- Araştırma uzmanı için isteğe bağlı Nemotron 3.5 Rerank 8B adaptörü: ilk 32 kaynak adayını ilgililik açısından yeniden sıralar, kaynak güvenilirliği ölçütünü korur. Hatalı yanıt/kota durumunda mevcut arama sıralamasına döner. `HAFIZE_NVIDIA_RERANK_ENABLED=true` yalnız ücretsiz erişim doğrulandıktan sonra açılmalıdır. NVIDIA referansı: https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3_5-rerank-8b-infer . Görsel üretimde gerçek PNG/JPEG imzası, güvenlik modelinde tanınabilir cevap biçimi denetlenir; mevcut erişim politikası değişmez.

## V5 — bağımsız NVIDIA uzman NIM servisleri
`/api/nim-specialists` mevcut kimlik doğrulaması ve CSRF korumasını kullanır. GET yalnız yapılandırma durumunu gösterir, erişim doğrulamaz. POST `/transcribe` (WAV base64 + language), `/synthesize` (text + language), `/parse` (PNG/JPEG base64) sabit operasyonları çalıştırır. ASR klasik Speech NIM REST sözleşmesini kullanır (Nemotron Transcribe'ın farklı sözleşmesi değildir). TTS yalnız operatörün kurulu modelde desteklendiğini doğruladığı dilleri kabul eder. Magpie Türkçe desteği varsayılmaz. Nemotron 3.5 Parse tek sayfa REST sözleşmesi kullanır; ham konum/sınıf tokenları korunur, `length` kesilme işaretidir. İstemci URL/anahtar veremez. Servisler yapılandırılana kadar mevcut yerel/tarayıcı sesleri ve görsel analiz değişmez. Bu adaptörler GPU veya ücretli servis oluşturmaz.

Ayarlar > NVIDIA Uzman Servisleri paneli: yapılandırma durumu, WAV transkripsiyon, metin seslendirme (WAV oynatma) ve tek sayfa OCR. Yalnız açık kullanıcı işlemiyle istek gönderir, iptal/temizle ve geçici ses URL'si yönetimi vardır. Mevcut sesli sohbet otomatik olarak bu servise geçirilmez. Günlük iyileştirme raporu `/api/models/status/daily` üzerinden, sohbet laboratuvarı yapılandırılmamış olsa da doğrulanmış sahibi tarafından okunabilir.

V5: Model Laboratuvarı varsayılan olarak mevcut SQLite veritabanında hesap/yapılandırma kapsamlı bir sentetik ölçüm snapshot'ı saklar; özel dosya deposu ayarı önceliklidir. 30 güne kadar geçmiş gözlem sıra adaletine yardımcı olur, fakat 24 saatlik ve daha kısa gerçek yönlendirme geçerlilik süreleri değişmez. Embedding ölçümleri de yeniden başlatmada korunur. Günlük rapor son 14 döngünün özetini ve görev lideri değişikliklerini içerir. Kalıcılık, mevcut DB'nin fiziksel depolama kalıcılığına bağlıdır; Render Free disk kaybı bunu yine sıfırlayabilir.

## V6 — günlük derin değerlendirme
Canlı testler açık olduğunda, güncel araç testi olan ama derin testi bulunmayan bir aday için iki isteğe kadar derin değerlendirme ayrılır; o gün normal sohbet testleri iki yerine bir adayla sınırlanır. Embedding dahil toplam üst sınır yine beş istektir. Derin testte kalite ölçütlerinin karşılanmaması rapora uyarı olarak yazılır. Başarılı biçim yanıtı tek başına embedding kalitesi sayılmaz; benzerlik sırası da doğru olmalıdır. Önceki 14 günlük döngü ve model lideri değişimleri ayarlarda gösterilir. Yarım kalan işlem yeniden başlatmadan sonra başarı gibi gösterilmez.
Derin değerlendirme ve geniş aday taraması günleri dönüşümlüdür. Önceki gün derin test yapıldıysa sıradaki gün iki aday taranır; aksi halde yeni bir adayın normal testi sonrası derin test de yapılabilir. Toplam beş istek sınırı korunur.
Uzman servisleri paneli son gerçek çağrının sonucunu ve gecikmesini gösterir. Yalnız başarılı doğrulanmış çıktı `passed` olur; hatalı cevaplar başarı sayılmaz. Gönderilen ses, metin ve belge içeriği ölçüm kaydına alınmaz. Gözlemler geçici süreç belleğindedir; yeniden başlatmada sıfırlanır. Bu durum modelin genel kalite veya sürekli erişim garantisi değildir.

Uzman ajan sağlık ölçümü son 24 saatteki en fazla 50 çağrıya dayanır; eski başarısızlıklar bir uzmanı sonsuza dek dışlamaz. Şema onarım çağrıları da günlük çağrı kotasına sayılır. SQLite çağrı rezervasyonu atomiktir; taşımada ortaya çıkan hatalar gizli hata içeriği saklanmadan ölçülür, kullanıcı iptali ve kota reddi kalite başarısızlığı sayılmaz.

## V7 — gerçek model kimliği ve iç içe uzman denetimi
Sunucu tarafından seçilen gerçek model, her JSON yanıtı için özel WeakMap ile eşleştirilir. Modelin yanıt içinde yazdığı model adı güvenilir yönlendirme kanıtı değildir. Token telemetrisi gerçek yönlendirme kimliğini kullanır; API çıktısı değiştirilmez. Alt uzman çağrıları da ana uzman gibi kota, şema doğrulama ve denetim sarmalından geçer; mevcut derinlik ve yetki sınırları korunur.
Türkçe derin yazım testi başarısız olduğunda aday ölçülmüş öncelik listesinden çıkar; görevle ilişkili ölçümler sıralamada daha yüksek ağırlık alır. Son fallback modeli de yanıt başlığı zaman aşımına tabidir (stream 25 sn, normal 90 sn); açılmış bir stream için bu süre sınırı uygulanmaz. Temel yapılandırılmış zincir fallback olarak korunur.

## V8 — çalışma zamanı kanıtı
Gerçek yönlendirme denemelerinin yalnız model kimliği, HTTP başlığı başarısı/sağlayıcı hatası, gecikme ve akış hatası sayıları saatlik SQLite toplamlarında tutulur. Kullanıcı içeriği, anahtar veya yanıt metni saklanmaz. Son 24 saatlik pencerede en az 8 deneme ve %25 hata oranı görülen modeller, yalnız zaten sentetik testlerle doğrulanmış adaylar arasında geriye alınır. Bu erişilebilirlik ölçümüdür, doğruluk kanıtı değildir. Mevcut fallback zinciri korunur. Günlük rapora çalışma zamanı özeti ve uyarlanmış liderler eklenir; ek sağlayıcı çağrısı yapılmaz. 14 günlük saklama, mevcut diskin kalıcılığına bağlıdır.
Günlük çalışma zamanı ölçümleri ve uyarlanmış liderler Ayarlar > Model Laboratuvarı bölümünde ayrıca gösterilir. İptaller model başarısızlığı sayılmaz; başarısız telemetri sohbeti durdurmaz.

## V9 — çevrimdışı uzman denetimi
Her günlük döngüde 12 uzman kartı, görev modeli profili, yetenekler, görev talimatları, giriş ve çıktı şemaları, kota sınırları, temel gerekli araç izinleri ve izinsiz kritik işlemlerin reddi denetlenir. Eksik uzman veya bozulan izin kuralı raporu kısmi olarak işaretler. Ayarlarda uzman bazında sonuçlar gösterilir. Bu denetim hiçbir araç çalıştırmaz ve model kalitesi veya canlı servis erişimi kanıtı değildir.
ASR/TTS WAV doğrulaması RIFF uzunluğu, fmt/data parçaları, PCM türü, kanal, örnekleme hızı, blok hizası, veri uzunluğu ve azami 300 saniye sınırını kontrol eder. Desteklenmeyen sıkıştırılmış WAV biçimleri reddedilir; mevcut tarayıcı sesleri değişmez. Bağımsız NIM servisleri hâlâ yapılandırılmalı ve gerçek protokol üzerinde doğrulanmalıdır.

### Örneklemeli video analizi
İsteğe bağlı HAFIZE_VIDEO_FRAMES_ENABLED=true ile en fazla dört JPEG kare, 300 saniyelik video süresi ve zaman damgaları mevcut görsel modeline iletilir. Ses ve tam video kapsamı olmadığı açıkça belirtilir. Kareler bu uç noktada saklanmaz. Varsayılan kapalı; canlı model erişimi henüz doğrulanmamıştır.
Ayarlar > NVIDIA Uzman Servisleri içinde video seçildiğinde tarayıcı, 100 MB ve 300 saniye sınırıyla dört örnek kareyi yerel olarak çıkarır (maksimum 768 px uzun kenar). Ham video gönderilmez; yalnız kullanıcı çalıştırdığında kareler ve isteğe bağlı açıklama iletilir. Kodek/cihaz uyumluluğu gerçek cihazda doğrulanmalıdır.

## V10 — katalog farkı ve kalıcı keşif
Katalog kimlikleri ve son gözlenen değişimler mevcut kapsamlı model snapshot'ında saklanır (30 gün; 256 KB dosya/DB sınırı). İlk sorgu başlangıç envanteridir. Sonraki sorgular yeni ve çıkarılmış kimlikleri raporlar; kısaltılmış/eksik kataloglarda çıkarılma sayısı bilinmiyor olarak kalır. Katalog erişim, ücretsiz fiyat veya test kanıtı değildir. HAFIZE_DAILY_CATALOG_DISCOVERY=true isteğe bağlı 48 saatte bir katalog keşfini açar; mevcut beş istek bütçesine dahil olur (keşif gününde embedding testi yapılmaz). Yeni modeller otomatik olarak aday veya fallback zincirine alınmaz.
Günlük rapor artık kanıta dayalı, en fazla 20 öncelikli geliştirme önerisi ve kabul ölçütü üretir. Hafta odağı Türkiye saatine göre belirlenir. Öneriler kaynak kodunu değiştirmez. Yarım kalmış döngü 4 dakikadan sonra sonraki zamanlayıcı kontrolünde kalıcı olarak kısmi raporlanır, aynı 24 saatlik hak yeniden harcanmaz; tamamlanma ve tarihçe aynı SQLite işleminde yazılır. Render tarafından verilen tam commit kimliği, varsa canlı sağlık uç noktasında yayımlanır.
GitHub kalite akışı ayrıca bağımsız çevrimdışı uzman denetimi ve haftalık odak raporunu çalıştırır. Zamanlanmış ve elle başlatılmış koşularda rapor 7 gün saklanır; gerçek sağlayıcı erişimi, backend sağlığı ve kaynak kodu değişikliği bu raporun kapsamı dışındadır.

## V11 — doğal Türkçe gerçek test isteği
`NVIDIA modellerinin gerçek API anahtarıyla kapsamlı test edilmesini yapar mısın` ve belirli eşdeğer tek cümleler doğrudan sunucu Model Laboratuvarına yönlenir, sohbet modeline yetki tahmini yaptırılmaz. Bir tur en fazla bir kısa model testi, bir derin test ve bir embedding testi (toplam en fazla beş istek) yapar. Sonuç ve bekleyen adaylar ayrı gösterilir. Ayarlarda kapsamlı test düğmesi bulunur. Geçerli sahip oturumu ve doğrudan NVIDIA bağlantısı zorunludur; doğru değişken NVIDIA_API_KEY, anahtar hiçbir zaman sohbet girdisi değildir. Yeni sağlayıcı veya GPU otomatik açılmaz; katalog fiyat kanıtı değildir. Aynı isteği tekrar etmek sıradaki adayları değerlendirir; bu tek turda tüm katalogun test edildiği anlamına gelmez.
