# Akıllı Görünümler Veri Modeli

## View

Bir görünüm şu alanları içerir:

- id: benzersiz yerel kimlik.
- name: kullanıcı tarafından görünen ad.
- description: isteğe bağlı açıklama.
- query: gelişmiş sorgu.
- favoriteOnly: core favori filtresi.
- tag: core etiket filtresi.
- sort: core sıralama değeri.
- minUse: minimum kullanım sayısı.
- maxUse: maksimum kullanım sayısı.
- hasVariables: değişken filtresi.
- pinned: görünüm sabitleme durumu.
- createdAt: ISO zaman damgası.
- updatedAt: ISO zaman damgası.

## State

Panel state aşağıdaki alanları içerir:

- query: görünüm listesinde arama.
- sort: görünüm listesi sıralaması.
- collapsed: panel kapalı mı.
- activeId: aktif görünüm kimliği.

## History

Geçmiş girdileri:

- id
- viewId
- name
- count
- appliedAt

Aynı görünüm art arda uygulanırsa tek kayıt altında kullanım sayısı artırılır.

## Normalizasyon

Array dışı girişler reddedilir.
Boş görünüm adları reddedilir.
Duplicate view id değerleri tutulmaz.
viewId olmayan geçmiş girişleri tutulmaz.
Sayı alanları güvenli aralıkta integer'a dönüştürülür.
Tarih metinleri bounded biçimde saklanır.

## Kapasite

MAX_VIEWS = 24
MAX_HISTORY = 20
MAX_NAME = 72
MAX_DESCRIPTION = 180
MAX_QUERY = 180
MAX_EXPORT = 300000

## İçe aktarma

İçe aktarılan görünüm yeni id ile eklenir.
Aynı isimde görünüm zaten varsa atlanır.
Kapasite doluysa kalan kayıtlar atlanır.
Mevcut istem kayıtları hiçbir şekilde değiştirilmez.

## PWA

Modüller shell cache listesinde açıkça bulunur.
API yanıtları görünüm storage'ına yazılmaz.
Service worker görünüm verisini backend response olarak cache'lemez.

## Sürümleme

Storage anahtarları `.v1` ile sürümlenir.
Şema değişirse eski v1 veri modeli geriye dönük okunabilir kalmalı veya açık migration kodu yazılmalıdır.
Yeni alanlar normalizeView içinde varsayılan değere sahip olmalıdır.