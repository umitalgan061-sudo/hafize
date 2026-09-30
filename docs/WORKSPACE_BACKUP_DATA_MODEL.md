# Çalışma Alanı Yedekleme Veri Modeli

## Root belge

format alanı hafize-workspace-backup değeridir.

version alanı şu an 1'dir.

exportedAt ISO tarih bilgisidir.

source alanı local-device olmalıdır.

sections dizisi kullanıcı seçimiyle taşınan yüzeyleri içerir.

integrity alanı SHA-256 doğrulama bilgisini taşır.

skipped varsa export dışında bırakılan yüzeyleri özetler.

## Section

Her section benzersiz id taşır.

key gerçek storage anahtarını veya kontrollü Smart Fill prefix'ini belirtir.

kind UI ve restore davranışını tanımlar.

label kullanıcıya gösterilen başlıktır.

description yüzeyin kapsamını açıklar.

data JSON uyumlu normalize edilmiş kullanıcı state'idir.

bytes section JSON verisinin yaklaşık byte uzunluğudur.

## Kimlik kuralları

Statik section id değeri storage key ile aynıdır.

Smart Fill section id prefix değerini kullanır.

Import bilinmeyen id ve key eşleşmelerini restore yüzeyi olarak kabul etmez.

Key uzunluğu 180 karakterle sınırlandırılır.

Smart Fill suffix'i güvenli karakter kümesiyle sınırlıdır.

## Prompt Library

Prompt kütüphanesi ayrı section olarak taşınır.

State section arama ve filtre tercihlerini taşır.

Collection section üyelik ilişkilerini taşır.

Revision section geçmiş sürümlerini taşır.

Smart Fill section dinamik preset key'lerini taşır.

## Sohbetler

Conversation state tek section olarak taşınır.

Mesajlar uygulamanın kendi normalize katmanında okunmaya devam eder.

Response alternates ayrı backup key gerektirmez.

Conversation branch metadata sohbet nesnelerinin içindedir.

## Mesaj Workspace

Mesaj metadata'sı kendi storage anahtarında tutulur.

Yedek, uygulamanın mevcut normalize sınırlarını değiştirmez.

Yüksek hacimli state section byte sınırına takılabilir.

## Model tercihleri

Model profile state tek section'da taşınır.

Model id ve agent id kullanıcı tercihidir.

Token veya authorization header bilgisi profile state'e dahil edilmez.

## Composer history

Composer geçmişi string listesi olarak taşınır.

Ayar state'i enabled ve retention davranışını taşır.

Bu iki state bağımsız seçilebilir.

## Task template

Görev şablonları gerçek scheduled task kayıtları değildir.

Şablon isim, task metni, agent id ve retry bilgisi taşır.

Backend task id, worker lease veya execution log taşınmaz.

## Task draft

Task draft yalnız geçici form state olarak ele alınır.

Geçici state'in yedeklenmesi isteğe bağlıdır.

## Metadata

hafize.workspace-backup.meta.v1 yalnız son export özetidir.

Metadata section sayısını taşır.

Metadata export byte sayısını taşır.

Metadata export tarihini taşır.

Metadata section contents taşımaz.

Metadata ikinci bir backup deposu değildir.

## Integrity kanonikleştirme

Hash için integrity alanı kanonik gövdenin dışında tutulur.

Object key'leri alfabetik sıralanır.

Dizi sırası korunur.

Primitive değerler JSON serialization ile temsil edilir.

Bu sayede hash girdisi deterministik olur.

## Import modeli

Parser bilinmeyen root shape'i reddeder.

Version 1 dışındaki belgeler şu an desteklenmez.

Section listesi en fazla 32 kayıt alınır.

Her section yüzey doğrulamasından geçer.

Smart Fill entry listesi en fazla 24 kayıt alınır.

Geçersiz section restore listesine eklenmez.

Hiç geçerli section kalmadığında import başarısızdır.

## Restore modeli

Restore yalnız kullanıcının seçtiği section id'lerini yazar.

Mevcut state önce captured raw map'e alınır.

Smart Fill özel durumda prefix altındaki mevcut key'ler yakalanır.

Restore exception sonrası raw map geri yazılır.

Success durumunda yalnız seçili section'lar değişir.

## İleri uyumluluk

Version increment edildiğinde yeni parser yolu eklenebilir.

Eski version güvenli şekilde reddedilebilir.

Yeni section kind'ları allowlist tablosuna eklenmeden restore edilemez.

Bu yaklaşım feature'ın sessizce yeni storage yüzeylerine genişlemesini engeller.

## Yaşam döngüsü

Export sonrası yedek dosyası browser download alanına çıkar.

Uygulama dosyanın kalıcı server kopyasını tutmaz.

Import dosyası memory üzerinden okunur.

Import dosya içeriğini ayrı storage alanına kopyalamaz.

Restore sonucu uygulama panellerinin mevcut normalize mantığı tarafından okunur.
