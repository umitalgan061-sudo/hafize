# Gizlilik Merkezi Test Matrisi

| Alan | Kontrol |
|---|---|
| Inventory | known exact/prefix classification |
| Inventory | unknown key count |
| Clear | single surface deletion |
| Clear | data-only preservation |
| Clear | full known cleanup |
| Safety | no network primitives |
| Safety | no global localStorage.clear |
| Report | content-free schema |
| Report | size bound |
| Accessibility | ARIA relationships |
| Accessibility | shortcut guard |
| DOM | textContent / replaceChildren |
| Lifecycle | listener cleanup |
| Storage | estimate fallback |
| PWA | asset registration |
| Regression | README and contract consistency |

Her satır en az bir source contract veya runtime smoke ile eşleşmelidir. Yeni storage yüzeyi eklemek matrix güncellemesini gerektirir.
