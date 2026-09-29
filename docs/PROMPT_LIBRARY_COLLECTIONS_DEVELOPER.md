# Koleksiyon Geliştirici Rehberi

Entry point:
`public/prompt-library-collections.js`

Keyboard:
`public/prompt-library-collections-keyboard.js`

Style:
`public/prompt-library-collections.css`

Initialization order:
Prompt Library core önce yüklenir.

Koleksiyon module sonra yüklenir.

Keyboard module en son yüklenir.

Core prompt listesi MutationObserver ile enhancement için izlenir.

Storage değişiklikleri window storage event'i ile senkronize edilir.

Public pure helpers:
- loadCollections
- loadMap
- loadDefaultCollection
- saveCollections
- saveMap
- saveDefaultCollection
- summarize
- getCollectionForPrompt
- collectionMatches
- pruneMap
- exportPayload
- normalizeImported
- mergeImported

Yeni helper eklerken bounded input davranışı korunmalıdır.

Dinamik DOM textContent kullanmalıdır.

Yeni asset index.html ve sw-policy.js ile birlikte eklenmelidir.
