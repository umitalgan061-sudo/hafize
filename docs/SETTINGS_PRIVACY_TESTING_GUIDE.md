# Test Yazma Rehberi

Yeni testler `test-*.mjs` biçiminde yazılmalıdır; runner bunları otomatik keşfeder.

Source contract testleri küçük, tek davranış odaklı tutulur.

Runtime smoke testleri `settings-privacy-fixture.mjs` üzerinden gerçek modülü yükleyebilir.

Storage fixture bilinmeyen key ve hassas görünümlü key senaryolarını içermelidir.

Bir test raw value'nin report'a girmediğini doğrulamalıdır.

Her destructive path en az bir positive ve bir preservation assertion taşımalıdır.
