# Bağlantılar kod inceleme notu

## Mimari

Hub mevcut backend endpoint'lerini kullanır. Yeni authorization katmanı değildir.

## UI

Kartlar DOM API ile oluşturulur. Dynamic textContent kullanılır.

## State

UI state küçük ve session-only'dir.

## Async

Provider sorguları paraleldir. In-flight ve cooldown guard vardır.

## Failure

Her endpoint bağımsız güvenli durum üretir. Bir failure tüm paneli boşaltmaz.

## Security

No-write client contract önemlidir. Bu panel GitHub write workspace değildir.

## Accessibility

Provider status text'i renk dışında görünürdür. Native controls kullanılır.

## PWA

Asset cache vardır, API response cache yoktur.

## Maintainability

Sabit endpoint URL'leri tek yerde tanımlanır. Provider metadata ayrı immutable sözlükte tutulur.

## Review checklist

- [ ] hidden state storage secret içermez
- [ ] fetch method GET
- [ ] credentials same-origin
- [ ] timeout cleanup
- [ ] destroy cleanup
- [ ] asset wiring
