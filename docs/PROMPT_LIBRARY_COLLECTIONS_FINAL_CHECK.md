# Koleksiyon Final Check

## Kod bütünlüğü

Collection module mevcut Prompt Library API'sine bağımlıdır ve core yüklenmeden mount olmamalıdır.

Collection module kendi storage key'lerini kullanır.

Default key bağımsızdır.

## UI

Collection paneli prompt library card içine eklenir.

Collection selector her prompt satırında görünür.

Filter select'i tüm collection, none ve collection seçeneklerini içerir.

Bulk assignment yalnız seçili promptlara uygulanır.

## Data

Collection ID normalize edilir.

Collection name normalize edilir.

Assignment map collection ve prompt varlığını kontrol eder.

Stale entries prune edilir.

## Import/export

Import destructive değildir.

Export object URL oluşturur ve revoke eder.

500 KB limit uygulanır.

## Default

Known prompt snapshot başlangıçta mevcut promptları kayıtlı kabul eder.

Yeni prompt ID'si ancak sonradan görüldüğünde default collection'a atanabilir.

Default collection silinirse NONE olur.

## Accessibility

Roles, labels ve live region'lar mevcuttur.

Editable alanlarda keyboard shortcut engellenir.

## PWA

CSS, module ve keyboard assetleri shell'e eklenmiştir.

## Release gate

Changed lines < 3000.

npm run check veya uygun CI sonucu raporlanmış olmalıdır.

Rollback planı PR body'de bulunmalıdır.
