# Smart Fill Migration Politikası

## Mevcut kayıtlar

Mevcut `hafize.prompt-library.v1` kayıtlarına migration yapılmaz. Smart Fill, mevcut `body` alanındaki değişkenleri çalışma anında keşfeder.

## Preset sürümü

Yeni veri alanı `hafize.prompt-library.smart-fill.v1` prefix'i altında tutulur. İleride şema değişirse yeni bir `v2` prefix'i oluşturulur.

## Geriye uyumluluk

Smart Fill kullanılmasa bile Prompt Library normal CRUD ve kullanım sayısı davranışı devam eder.

## İçe aktarma

Prompt Library JSON import'u Smart Fill presetlerini okumaz. Böylece eski yedekler yeni feature tarafından yanlışlıkla yorumlanmaz.

## Taşıma

Presetlerin başka cihaza taşınması bu sürümün dışında tutulmuştur. Taşınabilir preset desteği gelecekte açık kullanıcı eylemi ve ayrı güvenlik tasarımı gerektirir.

## Bozuk sürüm

Preset JSON'u okunamazsa migration tetiklenmez; güvenli varsayılan boş liste kullanılır.

## Çakışma

Aynı prompt id ile farklı cihazdan gelen presetler birleştirilmez. Bunun sebebi gizlilik ve beklenmeyen overwrite riskini azaltmaktır.

## Silinen prompt

Prompt silinse bile stale preset anahtarları uygulamanın ana prompt listesine etki etmez. Bu sürümde otomatik garbage collection yapılmaz.

## Release geçişi

Cache sürümü v29 ile Smart Fill ve live-hints asset'leri shell'e alınır. Migration yalnız gerekli storage namespace'lerini tanımlar; mevcut kullanıcı promptlarına dokunmaz.

## Rollback

Rollback ana prompt storage'ını geri çevirmeyi gerektirmez. Smart Fill olmayan sürüm kendi tanımadığı preset anahtarlarını kullanmadan çalışabilir.
