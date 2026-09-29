# Model ve Ajan Tercihleri Karar Kayıtları

## ADR-01: localStorage

Tercihler localStorage'da tutulur.
Nedeni: özellik cihaz tercihi niteliğindedir ve backend bağımlılığı gerektirmez.

## ADR-02: conversation state ayrı

Profil state'i conversation state'e gömülmez.
Nedeni: aynı profil birçok sohbette kullanılabilir.

## ADR-03: altı profil

Profil sayısı sınırlıdır.
Nedeni: panel küçük tutulur ve gereksiz yerel veri birikimi önlenir.

## ADR-04: açık import

Import mevcut state ile birleştirilir.
Çakışan ID overwrite edilmez.
Nedeni: kullanıcı yedeği başka bir cihazdan taşırken kayıp yaşamamalıdır.

## ADR-05: apply submit etmez

Profil uygulaması composer submit başlatmaz.
Nedeni: ayar değişikliği ile kullanıcı mesajı gönderme eylemi ayrıdır.

## ADR-06: server authority

UI yalnız mevcut model ve ajan seçeneklerine göre seçim yapar.
Gerçek yetki backend'dedir.
Nedeni: istemci tarafında authorization yeniden uygulanmamalıdır.

## ADR-07: versioned export

Export payload'ına version ve source alanı konur.
Nedeni: gelecekte migration ve format teşhisi yapılabilmesi.
