# Prompt Diagnostics — QA

## Tanı doğruluğu

Tanı boş prompt storage'ı sağlıklı olarak raporlar. Geçerli prompt'lar id kümesine alınır. Normalize edilemeyen kayıtlar bozuk olarak sayılır. Aynı id ikinci kez görülürse duplicate sayacı artar.

## Collection ilişkisi

Collection storage yoksa temel Prompt Library çalışması etkilenmez. Collection listesi geçerliyse her `promptIds` değeri mevcut prompt id kümesiyle karşılaştırılır. Bulunmayan id'ler yetim üye olarak raporlanır.

## Onarım

Sağlıklı kütüphanede onar düğmesi pasiftir. Sorun bulunduğunda kullanıcı onayı gerekir. Prompt repair mevcut normalizer'ı kullanır. Collection repair yalnız geçerli prompt id'lerini bırakır.

## Sınırlar

Prompt taraması bounded sayıda kayıtla yapılır. Yetim üye listesi bounded tutulur. Büyük veya bozuk storage, tanı panelinin sınırsız bellek tüketmesine yol açmamalıdır.

## Hata durumları

JSON parse başarısız olduğunda uygulama exception ile çökmez. localStorage okunamıyorsa boş güvenli sonuç döndürülür. Yazma başarısızlığı kullanıcıya kısa durum mesajı verir.

## Güvenlik

Tanı paneli prompt body metnini render etmez. Ham storage içeriği HTML olarak değerlendirilmez. Telemetry veya backend çağrısı yapılmaz.

## Yaşam döngüsü

Panel tek kez mount edilir. Destroy çağrısından sonra DOM düğümü kaldırılır ve event listener'lar temizlenebilir. Yeniden mount duplicate panel üretmemelidir.
