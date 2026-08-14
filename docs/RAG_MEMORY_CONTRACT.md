# Hafize kişisel bellek ve RAG sözleşmesi

Bu sözleşme Agency Agents içindeki RAG Pipeline Engineer ve Privacy Engineer yaklaşımlarını Hafize'nin gelecekteki kişisel bellek ve belge aramasına uyarlar.

## Temel hedef

RAG başarısı yalnız bir embedding modeli seçmek değildir. Sistem doğru kullanıcı verisini doğru kapsamda bulmalı, ilgisiz içeriği elemeden modele taşımamalı ve cevapta kullanılan kaynağın nereden geldiğini izleyebilmelidir.

## Veri kapsamı

Her indekslenebilir parça en az şu metadata'yı taşımalıdır:

- owner/user scope;
- kaynak türü;
- kaynak kimliği;
- oluşturulma veya güncellenme zamanı;
- varsa proje/konuşma/thread ilişkisi;
- görünürlük ve retention sınıfı.

Bir kullanıcının verisi başka kullanıcı retrieval sonucuna giremez. Scope filtresi similarity aramasından sonra yapılan kozmetik bir filtre değil, retrieval sınırının parçasıdır.

## Chunking ilkesi

Sabit karakter sayısıyla kör parçalama varsayılan yöntem değildir. Kaynak türüne göre yapısal sınırlar tercih edilir:

- Markdown: başlık ve bölüm;
- e-posta: mesaj ve thread yapısı;
- sohbet: turn veya anlamlı konuşma bölümü;
- kod: fonksiyon/sınıf/modül sınırı;
- uzun belge: paragraf ve semantik bölüm.

Chunk, kendi başına anlam taşıyacak kadar büyük; retrieval sonucunu gereksiz gürültüyle doldurmayacak kadar küçük olmalıdır.

## Retrieval hattı

Önerilen sıra:

1. Owner ve kaynak kapsamı filtresi.
2. Query normalization.
3. Aday retrieval.
4. Gerekirse lexical + semantic sonuç birleştirme.
5. Gerekirse ölçülmüş faydası olan reranking.
6. Context bütçesine göre seçme ve deduplication.
7. Kaynak metadata'sıyla modele handoff.

Her yeni katman ölçülmüş kalite artışı sağlamalıdır. Sırf mimariyi karmaşıklaştırdığı için reranker veya ikinci arama motoru eklenmez.

## Kaynak ve citation

Retrieval sonucu en az kaynak kimliğini korur. Kullanıcı "bunu nereden biliyorsun?" dediğinde sistem mümkün olduğunca ilgili memory/document/message kaynağına geri dönebilmelidir.

Modelin cevabı ile retrieval kaynağı birbirinden ayrılır: kaynakta olmayan yeni model çıkarımı kaynakta yazıyormuş gibi gösterilmez.

## Kişisel bellek yazma sınırı

RAG index'i, kullanıcının söylediği her cümleyi otomatik kalıcı hafıza kabul etmez. Kalıcı memory write ayrı ürün ve izin sözleşmesine tabidir. Geçici sohbet context'i ile uzun süreli kişisel bellek aynı yaşam döngüsünü paylaşmaz.

Credential, access key veya benzeri hassas değerler kişisel bellek retrieval corpus'una alınmaz.

## Silme ve retention

Bir kaynak silindiğinde ona bağlı chunk/index kayıtlarının da temizlenebilir olması gerekir. Silinmiş kaynağın embedding'i arama sonucunda yaşamaya devam ediyorsa deletion tamamlanmış sayılmaz.

Retention politikası kaynak türüne göre uygulanabilir; süresi dolan veri retrieval corpus'undan da çıkarılır.

## Değerlendirme veri seti

Production öncesinde küçük ama gerçekçi bir golden set tutulur. Her örnek:

- sorgu;
- beklenen kaynak veya kaynaklar;
- kabul edilebilir cevap kapsamı;
- yanlış pozitif olarak gelmemesi gereken kaynaklar

içerebilir.

Ölçümler yalnız LLM cevabını değil retrieval aşamasını da kapsar: recall, precision/top-k isabeti, yanlış owner/source sonucu ve context gürültüsü.

## Failure davranışı

Yeterli kaynak bulunamadığında sistem uydurma kişisel hafıza üretmez. "Bu bilgiyi kayıtlı kaynaklarda bulamadım" benzeri açık belirsizlik, yanlış kesinlikten daha doğrudur.

Index servisi geçici olarak kullanılamıyorsa normal sohbet mümkünse devam edebilir; ancak kişisel bellek kullanılmış gibi gösterilmez.

## Sağlayıcı bağımsızlığı

Kaynak repodaki örnek sağlayıcılar mimari zorunluluk değildir. Hafize'nin NVIDIA NIM önceliği korunur; embedding veya reranking sağlayıcısı değişse bile owner scope, metadata, eval ve deletion sözleşmeleri aynı kalmalıdır.

## Finish gate

RAG/memory özelliği ancak owner isolation, deletion propagation, kaynak izlenebilirliği, golden retrieval testleri ve yetersiz kanıt durumundaki güvenli fallback doğrulandığında hazır kabul edilir.
