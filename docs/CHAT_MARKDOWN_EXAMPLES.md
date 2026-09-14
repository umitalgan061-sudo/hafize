# Chat Markdown Kullanım Örnekleri

## Başlık ve paragraf

Model şu biçimde bir cevap verdiğinde başlık ve paragraf ayrı görsel katmanlar olarak çizilir:

```text
# Sonuç

İşlem başarıyla tamamlandı.
```

Uygulama bunu kendi başlık hiyerarşisini koruyacak şekilde render eder.

## Liste

```text
- Birinci adım
- İkinci adım
```

## Sıralı liste

```text
4. Dördüncü adım
5. Beşinci adım
```

Başlangıç numarası `4` olarak korunur; liste browser default `1` ile başlamaz.

## Görev listesi

```text
- [x] Kod yazıldı
- [ ] Test bekliyor
```

İşaretler yalnız görsel durum bilgisidir ve tıklanabilir görev kontrolü değildir.

## Kod

```text
```js
const result = await doWork();
```
```

Kod ayrı bir scroll kabında kalır. Dil etiketi küçük güvenli bir sınıfa çevrilir.

## Alıntı

```text
> Bu bir kaynak notudur.
```

## Tablo

```text
| Alan | Durum |
| :--- | ---: |
| Model | hazır |
| Araç | kapalı |
```

Geniş tablo mobilde yatay olarak kendi kapsayıcısında kaydırılır.

## Güvenli bağlantı

```text
[Resmî site](https://example.com)
```

HTTP, HTTPS ve mailto bağlantıları kabul edilir.

## Güvenli olmayan bağlantı

```text
[x](javascript:alert(1))
```

Bu bağlantı tıklanabilir node'a dönüşmez; metin olarak kalır.

## Raw HTML

```text
<img src=x onerror=alert(1)>
```

Bu ifade image node'una dönüştürülmez. Kullanıcıya metin olarak gösterilir.

## Streaming

Asistan cevabı üç parçada gelirse ilk parçada açılan fence kapanmamış durumda render edilebilir. Sonraki parçalar geldiğinde kaynak değişir ve aynı mesaj güncellenir. Renderer kendi DOM mutation'ından sonra tekrar tekrar sonsuz render yapmaz.
