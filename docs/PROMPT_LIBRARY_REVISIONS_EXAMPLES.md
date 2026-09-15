# Revision History Examples

## Örnek 1 — Basit düzenleme

Prompt: `Toplantı notlarını özetle.`

Kullanıcı Düzenle'ye bastığında mevcut başlık/body/tags `before-edit` revision olarak kaydedilir. Kullanıcı body'yi değiştirip kaydettiğinde ana kayıt yeni durum olur. History daha sonra eski metni gösterir.

## Örnek 2 — İkinci düzenleme

İlk değişiklikten sonra kullanıcı tekrar düzenler. Bu kez önceki yeni durum ikinci snapshot olur. Böylece history kronolojik geri dönüş noktaları sağlar.

## Örnek 3 — Yanlış değişiklik

Kullanıcı prompt'u çok kısaltır. History panelinden önceki sürümü karşılaştırır ve Geri yükle'yi seçer. Uygulama önce mevcut yanlış durumu manual snapshot'a alır, sonra eski revision'ı uygular.

## Örnek 4 — Kullanım sayısı

Prompt daha önce 17 kez kullanılmış olsun. Eski revision restore edilse bile `useCount` 17 kalır. Usage statistics gerçek kullanım bilgisini kaybetmez.

## Örnek 5 — Favori

Prompt favorideyse restore sonrası favori durumu korunur.

## Örnek 6 — Retention

Aynı prompt 12 farklı içerikle düzenlenirse son 10 revision saklanır. İlk iki kayıt retention dışına çıkar.

## Örnek 7 — Duplicate

Kullanıcı editorü açıp vazgeçer ve aynı içeriği tekrar düzenlerse aynı snapshot ikinci kez saklanmaz.

## Örnek 8 — Compare

Karşılaştırma iki panelde mevcut ve seçilen revision body'sini bounded preview olarak gösterir. Kullanıcı değişikliği doğrudan görür.

## Örnek 9 — Clear

History temizlendiğinde prompt yaşamaya devam eder. Usage, favorite ve main prompt verileri korunur.

## Örnek 10 — Export

Tek prompt history JSON olarak dışa aktarılır. JSON içindeki body'ler kullanıcının kendi cihazından dışarı çıktığı için paylaşım öncesi hassas veri kontrolü kullanıcıya aittir.

## Örnek 11 — Offline

PWA offline modda revision scriptini shell cache'ten yükler. Storage mevcutsa history görüntülenebilir; backend bağlantısı gerekmez.

## Örnek 12 — Storage quota

Storage doluysa capture false dönebilir. Main editor davranışı revision kaydının başarısızlığı nedeniyle crash olmamalıdır.

## Örnek 13 — Silinmiş prompt

History açıkken başka bir feature prompt'u silerse restore hedefi bulunamaz. Restore işlemi güvenli şekilde failure sonucu verir.

## Örnek 14 — Manual rollback

Bir revision restore edildiğinde eski mevcut state manual olarak tutulur. Kullanıcı önceki state'e dönmek için bu manual revision'ı seçebilir.

## Örnek 15 — Hassas metin

Prompt body içinde gizli bilgi bulunuyorsa history de aynı gizliliği taşır. Support için export paylaşılmadan önce redaction yapılmalıdır.
