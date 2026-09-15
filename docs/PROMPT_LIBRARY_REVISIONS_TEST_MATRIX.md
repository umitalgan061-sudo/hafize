# Revision History Test Matrix

| ID | Alan | Senaryo | Beklenen |
|---|---|---|---|
| R01 | Mount | Card yok | null/skip |
| R02 | Mount | İkinci mount | duplicate panel oluşmaz |
| R03 | Capture | Geçerli prompt | snapshot oluşur |
| R04 | Capture | Boş body | snapshot oluşmaz |
| R05 | Capture | Aynı body | duplicate oluşmaz |
| R06 | Capture | Farklı body | yeni snapshot |
| R07 | Capture | Uzun title | 100 karaktere bounded |
| R08 | Capture | Uzun body | 8000 karaktere bounded |
| R09 | Capture | Fazla tag | 8 tag |
| R10 | Capture | Uzun tag | 24 karakter |
| R11 | Store | Bozuk JSON | boş store |
| R12 | Store | Array root | boş store |
| R13 | Store | Yanlış promptId | revision atılır |
| R14 | Store | 11 revision | 10 revision kalır |
| R15 | Store | 121 prompt | 120 prompt işlenir |
| R16 | List | geçersiz id | boş list |
| R17 | List | birden çok revision | newest-first |
| R18 | Remove | mevcut revision | yalnız hedef silinir |
| R19 | Remove | olmayan revision | store değişmez |
| R20 | Clear | prompt history | yalnız hedef history silinir |
| R21 | Restore | geçerli target | body/title/tags döner |
| R22 | Restore | prompt yok | failure result |
| R23 | Restore | invalid revision | failure result |
| R24 | Restore | favorite | korunur |
| R25 | Restore | useCount | korunur |
| R26 | Restore | createdAt | korunur |
| R27 | Restore | updatedAt | yenilenir |
| R28 | Restore | yanlış seçim | onay gerekir |
| R29 | Restore | önceki state | manual snapshot oluşur |
| R30 | Compare | aynı içerik | same-state status |
| R31 | Compare | farklı içerik | yan yana gösterim |
| R32 | Compare | uzun body | preview bounded |
| R33 | Export | normal history | valid JSON |
| R34 | Export | 1 MB üstü | bounded fallback |
| R35 | Export | prompt title | dosya adına girmez |
| R36 | Export | ağ yok | local Blob çalışır |
| R37 | DOM | HTML payload | text-only |
| R38 | DOM | script payload | execute edilmez |
| R39 | A11y | dialog | role/aria semantics |
| R40 | A11y | Escape | panel kapanır |
| R41 | A11y | Tab | focus trap |
| R42 | A11y | Shift+Tab | reverse trap |
| R43 | A11y | close | focus geri döner |
| R44 | Lifecycle | destroy | listener temizlenir |
| R45 | Lifecycle | destroy | observer temizlenir |
| R46 | Lifecycle | destroy | panel silinir |
| R47 | Events | StorageEvent | core refresh |
| R48 | Events | fallback | custom refresh |
| R49 | PWA | shell asset | revision script cache'te |
| R50 | PWA | cache version | artmış olmalı |
| R51 | Privacy | source | fetch yok |
| R52 | Privacy | source | XHR yok |
| R53 | Privacy | source | WebSocket yok |
| R54 | Support | quota failure | kullanıcıya hata |
| R55 | Support | bozuk JSON | crash yok |
| R56 | Compatibility | core yok | graceful no-op |
| R57 | Compatibility | StorageEvent yok | fallback |
| R58 | Regression | existing CRUD | değişmez |
| R59 | Regression | usage | useCount korunur |
| R60 | Regression | smart-fill | prompt içeriği bozulmaz |
