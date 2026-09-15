# Prompt Workspace — Güvenlik Sözleşmesi

## Tehdit yüzeyi

Prompt Workspace tamamen browser tarafında çalışır. Yeni ağ istemcisi, analytics SDK'sı, remote sync veya credential store eklemez. Bunun temel güvenlik getirisi prompt içeriğinin yeni bir sunucu yüzeyine taşınmamasıdır.

## Import

İçe aktarılan dosya parse edilmeden önce boyut ile sınırlandırılır. JSON olmayan içerik reddedilir. Pack version ve source alanları doğrulanır. Temel prompt normalize işlemi mevcut çekirdeğin limitlerini kullanır.

## ID çakışması

İthal edilen istem kimliği mevcut istemle aynıysa mevcut kayıt değiştirilmez. Collection ve workspace importlarında isim çakışmaları da mevcut kaydın üzerine yazmak yerine yeni ada dönüşür veya kayıt atlanır.

## DOM

Kullanıcı verisi HTML string olarak enjekte edilmez. Başlık, gövde, etiket ve durum alanları `textContent`, form `value` veya güvenli dataset alanlarıyla taşınır.

## Composer

Smart Insert ve Workflow yalnızca composer değerini ayarlar. `submit`, click-send veya otomatik fetch çağrısı yoktur. Kullanıcının açık gönderme eylemi korunur.

## Revizyonlar

Revizyon geçmişi yalnızca mevcut istem içeriğinin yerel kopyalarını taşır. Revizyon restore işlemi mevcut sürümü önce korumayı dener ve sonra restore edilmiş sürümü yeni bir snapshot olarak kaydeder.

## Storage bozulması

JSON parse hatası boş varsayılan yapı üretir. Tek bir bozuk anahtarın diğer storage alanlarına bulaşmaması için her alan bağımsız okunur.

## Sınırlar

Workspace 16, workflow 24, workflow adımı 8, collection 24, toplu seçim 40, revizyon 8/istem ve pack 1,5 MB sınırları DoS benzeri istemci büyümesini engellemek için uygulanır.

## Service worker

Prompt Workspace asset'leri shell cache'e eklenebilir; prompt verileri veya API response'ları cache'e eklenmez. API yolları network-only politikasında kalır.

## Kullanıcı eylemleri

Silme işlemleri confirm gerektirir. Export kullanıcı tıklamasıyla başlar. Import önce review panelinden geçirilebilir. Hiçbir işlem kullanıcının dış servis yetkisini artırmaz.

## Veri sızıntısı kontrolü

Kaynak kodda secret, token veya remote endpoint bulunmamalıdır. Prompt body'nin URL'ye dönüştürülmesi beklenmez. Hata mesajları sınırlı tutulur ve tam prompt içeriğini loglama yoluna girilmez.
