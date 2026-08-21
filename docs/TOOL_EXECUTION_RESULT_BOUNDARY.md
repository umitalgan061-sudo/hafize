# Tool execution result trust boundary

Hafize tool-calling sonuçlarını model bağlamına veya task ledger'a taşımadan önce backend tarafında doğrular ve immutable bir JSON snapshot'a dönüştürür.

## Neden ayrı bir sınır var?

Tool authorization bir aracın **çalışıp çalışamayacağını** belirler. Bu tek başına aracın döndürdüğü JavaScript değerinin model bağlamına güvenle eklenebileceği anlamına gelmez.

Connector veya tool handler dönüşü aşağıdaki sorunları taşıyabilir:

- circular object graph,
- getter/accessor ile okununca yan etki üreten alan,
- Proxy trap'i,
- class instance veya JSON dışı değer,
- `BigInt`, `undefined`, `NaN` veya sonsuz sayı,
- aşırı derin/geniş object graph,
- model context'ini kontrolsüz büyüten çok büyük payload.

Bu nedenle tool sonucu ikinci NVIDIA isteğine doğrudan geçirilmez. Önce `lib/tool-execution-result-policy.mjs` sınırından geçer.

## Başarılı sonuç sözleşmesi

Başarılı bir tool sonucu yalnız şu envelope ile taşınır:

```json
{"ok":true,"value":"<bounded JSON-compatible snapshot>"}
```

`value` için:

- yalnız `null`, string, boolean, finite number, Array ve plain/null-prototype object kabul edilir;
- accessor alanlar çalıştırılmaz ve sonuç reddedilir;
- symbol/function/undefined/bigint gibi JSON dışı değerler reddedilir;
- circular graph reddedilir;
- class instance gibi özel prototype'lar reddedilir;
- snapshot recursively immutable olur;
- kaynak nesne sonradan mutate edilse bile modele taşınan snapshot değişmez.

## Boyut ve karmaşıklık sınırları

Varsayılan hard sınırlar:

- serialized tool value: en fazla 384 KiB UTF-8,
- derinlik: en fazla 12,
- object/array node bütçesi: en fazla 8192,
- tek object'te en fazla 512 own key,
- tek array'de en fazla 2048 item.

Bu sınırlar tool'un kendi upstream limitlerinin yerine geçmez. Örneğin GitHub read kendi dosya boyutu limitini ayrıca uygular. Tool-result policy, farklı connector'ların ortak model-handoff sınırıdır.

## Hata sözleşmesi

Failure sonucu yalnız bounded ve public alanlardan oluşur:

```json
{"ok":false,"error":"STABLE_ERROR_CODE","status":503}
```

Opsiyonel `reason` yalnız backend authorization gibi kontrollü kısa açıklamalar içindir. Raw provider exception message/body/credential sonucu modele taşınmaz.

Thrown error üzerinde `code` veya `status` accessor ise getter çalıştırılmaz. Güvenli own data property değilse sabit `TOOL_EXECUTION_FAILED` kullanılır.

## Ledger savunması

`agent-run-ledger` tool completion sırasında sonucu yeniden doğrular. Böylece ileride başka bir caller yanlışlıkla `tool-runtime` normalizasyonunu atlasa bile malformed veya hostile sonuç task'i başarıyla kapatamaz.

Geç gelen çelişkili completion önceki terminal ledger kaydını değiştiremez; task-ledger terminal immutability sözleşmesi ayrıca geçerlidir.

## Provider bağımsızlığı

Bu sınır NVIDIA'ya özgü bir yetkilendirme mekanizması değildir. Tool permission kararı hâlâ backend `default-deny` policy ile verilir. NVIDIA NIM ana sağlayıcıdır; local provider tool calling desteklemediği için local model seçiliyken mevcut provider-tool boundary fail-closed davranmaya devam eder.

## Secret ve harici içerik

Bu politika bir secret tarayıcısı değildir. Secret/credential değerlerinin tool bağlamına hiç sokulmaması üst seviye zorunluluktur. Connector'ların kendi allowlist, path/scope ve authentication sınırları korunur.

Harici kaynaktan gelen metin model açısından **veridir**; sistem talimatı veya yeni tool yetkisi vermez.

## Failure davranışı

Tool dönüşü doğrulanamazsa:

- handler yeniden otomatik çalıştırılmaz,
- sonuç başarı olarak ledger'a yazılmaz,
- model handoff'a raw değer sokulmaz,
- sabit `TOOL_RESULT_*` failure envelope'u kullanılır.

Bu davranış dış yazma/gönderme/merge işlemlerinde gereken explicit approval kurallarını değiştirmez veya gevşetmez.
