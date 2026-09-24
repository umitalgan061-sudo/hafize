# Bağlantılar performans notu

## İstek modeli

İlk mount'ta üç küçük GET sorgusu paralel başlatılır.

## DOM

Provider kartları bir kez oluşturulur. Refresh sırasında yalnız durum satırları değiştirilir.

## Storage

SessionStorage tek boolean state için kullanılır. Büyük response serialize edilmez.

## Rendering

Health summary üç status row ile sınırlıdır. Provider kartları tek status row üretir.

## Timeout

Sekiz saniyelik timeout sonsuz beklemeyi önler.

## Cooldown

900 ms refresh cooldown'u tıklama patlamasını sınırlar.

## Observer

Hub kendi DOM tree'si üzerinde MutationObserver kullanmaz. Workspace navigation kendi child-list gözlemini sürdürür.

## Offline

API response cache'lenmez; stale data yerine açık network failure gösterilebilir.

## Mobile

CSS breakpoint küçük DOM üzerinde tek kolona geçer.

## Kabul ölçütleri

- refresh aynı anda tek kez çalışır
- provider cevapları bağımsız render edilir
- destroy sonrası timer/event bırakılmaz
