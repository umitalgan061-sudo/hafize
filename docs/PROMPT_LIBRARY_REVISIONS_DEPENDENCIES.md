# Revision History Dependencies

## Core API

Revision module `HafizePromptLibrary` core API'sine bağlanır. Gerekli fonksiyonlar loadItems, normalizeItem ve saveItems'tır.

## Browser APIs

Kullanılan platform yetenekleri localStorage, document.createElement, MutationObserver, Blob, URL ve StorageEvent'dir.

## External dependencies

NPM package veya CDN dependency eklenmez.

## Loader

Revision scripti Prompt Library enhancements layer tarafından lazy-load edilir. Aynı script ikinci kez eklenmez.

## PWA

Service worker shell listesi revision scriptini içerir.

## Security

Revision module connector veya network client import etmez.

## Failure isolation

Core module yoksa revision loader yalnız no-op olur.

## Testing dependencies

Testler Node built-in assert, fs ve gerektiğinde vm modüllerini kullanır. Üçüncü taraf test dependency eklenmez.

## Versioning

Storage key `v1` ile versionlanır. Gelecekte breaking schema değişirse yeni key veya açık migration gerekir.

## Upgrade order

Önce revision scripti ve testleri, sonra loader ve service worker asset listesi birlikte release edilmelidir.

## Rollback order

UI loader geri alınabilir; revision storage key korunur. Service worker cache version feature öncesi değere döner.

## Maintenance

Core Prompt Library modelinde değişiklik olduğunda restore invariant testleri yeniden gözden geçirilmelidir.

## Ownership

Revision code Prompt Library feature sınırında tutulur; genel storage utility'lerine bağımlılığı minimumdur.

## Compatibility

Ana Prompt Library CRUD kaldırılmadan revision özelliği devre dışı bırakılabilir.
