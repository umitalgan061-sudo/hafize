# Markdown örnekleri

## Metin

```text
# Ana başlık
Normal açıklama.
**Vurgulu** ve *italik* metin.
~~Eski ifade~~
```

Bu içerik başlık, paragraf ve inline vurguya dönüşür.

## Liste

```text
- Birinci öğe
- İkinci öğe
  - İçerik düzleştirilmiş güvenli metin olarak kalır.
1. İlk adım
2. İkinci adım
```

## Görev listesi

```text
- [x] Taslağı hazırla
- [ ] Son kontrolü yap
```

Kutular yalnızca görüntülenir.

## Alıntı

```text
> Kullanıcıya verilen kısa bir not.
```

## Kod

```text
```js
const answer = 'Hafize';
console.log(answer);
```
```

Dil etiketi `js` olarak gösterilir. Kod çalıştırılmaz.

## Tablo

```text
| Alan | Değer |
| --- | --- |
| Model | NVIDIA |
| Durum | Hazır |
```

Her hücre güvenli inline parser'dan geçer.

## Link

```text
[Hafize](https://example.com)
```

Yalnız izin verilen URL şemaları link olur.

## Güvenlik örneği

```text
[Tehlikeli](javascript:alert(1))
```

Bu ifade linke dönüşmez.

HTML benzeri metin de çalıştırılmaz:

```text
<script>alert('x')</script>
```

## Yanıt araçları

Uzun bir yanıtın altında:

- Kopyala: ham yanıt metnini panoya alır.
- İndir: yerel Markdown dosyası oluşturur.
- Alıntıla: yanıtı composer alanına `>` biçiminde kopyalar.
- Ham metin: biçimlendirilmiş görünümü geçici olarak plain text yapar.
- Yanıtı daralt: uzun yanıtı küçük bir görünüm alanına toplar.

## Başlık özeti

İki veya daha fazla başlık içeren yanıtlarda `Başlık özeti` düğmesi çıkar.

Başlık bağlantıları aynı yanıt içindeki ilgili bölümlere gider.

## Sınırlar

24.000 karakter üstü response renderer tarafından kesilir.

240 blok üstü parse edilmez.

1.200 karakteri aşan satırların işlenen kısmı sınırlıdır.
