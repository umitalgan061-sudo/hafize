# Zamanlanmış Görevler — Organizer Sözleşmesi

## Amaç

Organizer, mevcut Zamanlanmış Görevler panelini daha büyük görev listelerinde kullanılabilir hale getirir.

Ana hedef, server schedule sözleşmesini değiştirmeden istemci tarafında hızlı keşif, güvenli toplu işlem ve tekrar kullanılabilir görünüm sağlamaktır.

## Kapsam

- Görev metni araması.
- Ajan filtresi.
- Çalıştırma zamanına veya duruma göre sıralama.
- Zamanlanmış görevleri seçme.
- Kullanıcı onayından sonra çoklu iptal.
- Görünür görevleri JSON olarak dışa aktarma.
- Tek görevin metnini kopyalama.
- Ayrıntı panelinde görev özetini görüntüleme.
- Zaman aralığı filtresi.
- Cihazda kaydedilebilir görünüm presetleri.

## Sunucu sınırı

Organizer yeni API endpoint'i oluşturmaz.

Listeleme `GET /api/schedules` ile yapılır.

Silme `DELETE /api/schedules/:id` ile yapılır.

Yeni kopya `POST /api/schedules` ile oluşturulur.

Server ownership ve credential policy tek gerçek otoritedir.

## Local storage

Görev içeriği organizer tercihlerine yazılmaz.

Kaydedilen görünüm yalnızca query, agent, sort, status ve time alanlarından oluşur.

Preset isimleri kullanıcı tarafından verilen kısa etiketlerdir.

Storage bozuksa veya kapalıysa özellik varsayılan görünümle çalışmaya devam eder.

## Güvenlik

Toplu iptal açık kullanıcı onayı ister.

Dışa aktarma açık kullanıcı işlemi olmadan çalışmaz.

DELETE path segment'i `encodeURIComponent` ile taşınır.

Görev metni DOM'a `textContent` ile yazılır.

Organizer token, cookie veya credential okumaz.

## Kabul

Filtre ve arama birbirini ezmemelidir.

Bir görev gizlenmiş olsa bile server listesinden silinmemelidir.

Toplu iptal yalnızca `scheduled` durumundaki kayıtları hedeflemelidir.

Export yalnızca görünür kayıtları içermelidir.

Ayrıntı paneli API yazma işlemi yapmamalıdır.

Preset uygulamak task payload'ını değiştirmemelidir.

## Uyum

Panel yokken organizer sessizce no-op olur.

Mevcut Zamanlanmış Görevler scriptleri bağımsız çalışabilir.

PWA shell organizer dosyalarını cache'leyebilir; `/api/` cevapları cache'lenmez.

## Non-goals

Recurring schedule backend modeli bu turda değiştirilmez.

Task ownership client'a taşınmaz.

Schedule status client tarafından uydurulmaz.

Task history ayrı bir local kopya haline getirilmez.

## Release gate

Kod diff'i 3000 değişen satır sınırını aşmamalıdır.

Static contract testleri yeşil olmalıdır.

PWA asset listesi dosyaları içermelidir.

README davranışı kullanıcı açısından tarif etmelidir.
