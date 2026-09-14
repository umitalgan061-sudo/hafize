# Prompt Library Data Model

## Ana kayıt

Bir prompt kaydı aşağıdaki alanlardan oluşur:

`id`: string; cihaz içinde benzersiz kimlik.

`title`: string; en fazla 100 karakter.

`body`: string; en fazla 8.000 karakter.

`tags`: en fazla 8 benzersiz string.

`variables`: gövdeden çıkarılan en fazla 12 değişken adı.

`favorite`: boolean.

`useCount`: sıfır veya pozitif tamsayı; 9.999 ile sınırlıdır.

`createdAt`: ISO benzeri zaman damgası.

`updatedAt`: ISO benzeri zaman damgası.

## State

Filtre state'i ayrı tutulur:

`query`: en fazla 120 karakter.

`tag`: belirli etiket veya `all`.

`favoriteOnly`: boolean.

`sort`: dört izinli değerden biri.

## Storage

Prompt kayıtları `hafize.prompt-library.v1` altında tutulur.

UI state `hafize.prompt-library.v1.state` altında tutulur.

Bu iki anahtar conversation history ile paylaşılmaz.

## Normalizasyon

Uygulama hem yüklemede hem import sırasında kayıtları normalize eder.

Geçersiz veya gövdesi boş kayıtlar atılır.

Etiketler trim edilir, tekrarlar düşürülür.

Değişkenler yalnız izinli karakterlerden oluşur.

Koleksiyon 120 kayıtta kesilir.

## Kimlik

Import sırasında aynı id overwrite edilmez.

Çakışma halinde yeni rastgele id üretilir.

Starter kayıtları da benzersiz kimlik üretir.

## Evrim

İleride v2 schema eklenirse mevcut `v1` doğrudan silinmemelidir.

Migration gerekiyorsa ayrı explicit migration fonksiyonu ve test paketi eklenmelidir.

Unknown alanlar normalize sırasında taşınmaz; model yalnız sözleşmeli alanları korur.

## Veri kaybı

Storage write başarısız olduğunda bellekteki kayıt kümesi kullanıcıya gösterilmeye devam edebilir fakat kalıcılık başarısızlığı status olarak bildirilir.

Import parse hatası current data üzerinde transaction benzeri davranış gösterir: merge başlamadan önce parse tamamlanır.
