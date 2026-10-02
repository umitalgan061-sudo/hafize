# TypeScript frontend troubleshooting

## Belirti: eski JS ve typed build birlikte çalışıyor
public/index.html içinde aynı modül için iki script tanımı olup olmadığını kontrol et. Migration regression gate bunu otomatik olarak yakalar.

## Belirti: PWA eski arayüzü gösteriyor
public/sw-policy.js içindeki cache sürümünü ve typed-build asset yolunu kontrol et. Cache sürümü aynı kaldığında eski shell dosyaları tarayıcıda yaşamaya devam edebilir.

## Belirti: chat akışı başlamıyor
Önce /api/chat isteğinin typed SSE transport üzerinden geçtiğini kontrol et. Tarayıcı console'unda SSE_TIMEOUT, SSE_ABORTED veya SSE_HTTP_ERROR gibi typed hata kodlarını ara.

## Belirti: akış donuyor
SSE frame ve buffer limitleri devreye girmiş olabilir. Beklenen cevap çok büyükse model output limitini azaltmak veya parçalı olay üretimini düzeltmek gerekir; limitleri sınırsız yükseltmek çözüm olarak kullanılmamalıdır.

## Belirti: kullanıcı bağlantıyı kestiği halde istek sürüyor
Parent AbortSignal zincirinin stream client'a aktarıldığını ve response reader'ın cancel edildiğini kontrol et. Stream state aborted olarak kapanmalıdır.

## Belirti: eski response yeni state'i eziyor
Async controller operationId değerini ve önceki operation'ın cancellation yolunu kontrol et. Yeni operation başladığında eskisi aktif kalmamalıdır.

## Belirti: localStorage veri yazmıyor
Storage boundary'nin STORAGE_WRITE_FAILED veya STORAGE_VALUE_TOO_LARGE hatasını raporlayıp raporlamadığını kontrol et. UTF-8 byte hesabı string.length değerinden farklı olabilir.

## Belirti: model/ajan listesi gelmiyor
HafizeApiClient çağrısını kullan ve doğrudan fetch ekleme. /api/models ve /api/agents response parser'ları schema dışı veriyi kabul etmemelidir.

## Belirti: ekran okuyucu stream durumunu duymuyor
Stream status yüzeyinin role=status, aria-live=polite ve aria-atomic=true özelliklerini koruduğunu kontrol et.

## Belirti: production build typed kaynağı almıyor
vite.config.ts içindeki entry ve transformIndexHtml eşleşmesini birlikte kontrol et. Dev ve production entry isimleri aynı olmalıdır.

## Belirti: migration gate başarısız
Önce hangi dosya sözleşmesinin bozulduğunu hata mesajından bul. Legacy entrypoint, Vite entry, PWA cache, credential marker veya duplicate script kontrollerinden sadece ilgili olanı düzelt.

## Belirti: testler yerelde çalışmıyor
Repo Node 24.21+ ve TypeScript 7.x ister. Global eski tsc/node ile sonuç üretme; proje bağımlılıkları kurulmuş güncel araç zincirini kullan.