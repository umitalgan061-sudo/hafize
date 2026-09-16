# Platform Runtime QA

## Smoke

- Uygulama ilk açılışta console exception üretmemeli.
- `Sistem` düğmesi yalnızca bir kez görünmeli.
- Panel açılıp kapanabilmeli.
- Escape paneli kapatmalı.
- Offline/online sinyalleri UI durumunu değiştirmeli.
- Storage estimate desteklenmiyorsa UI bozulmamalı.

## Typed checks

`npm run typecheck` veya `npm run build` sırasında yeni `.ts` dosyalarının tamamı kontrol edilmelidir.

## Source checks

Contract testleri şu alanları doğrular:

- lifecycle
- capability detection
- policy matrix
- performance budgets
- diagnostics privacy
- task queue safety
- event bus isolation
- error redaction

## Accessibility

Dialog semantiği, aria-labelledby, aria-describedby, keyboard Escape ve görünür focus kontrol edilmelidir. `prefers-reduced-motion` ve `forced-colors` fallback'leri gözlemlenmelidir.

## Security

Diagnostic JSON içinde chat metni, auth cookie veya bearer token bulunmamalıdır. Dynamic UI textContent tabanlı kalmalıdır.

## PWA

Offline app shell açılabilmeli. `/api/` istekleri cache'den servis edilmemeli. Typed app bundle cache'e dahil olmalıdır.

## Regression

Legacy feature'lar platform runtime yokmuş gibi çalışmaya devam etmelidir. Feature adapter yalnızca gözlem için kullanılmalı; mevcut controller'ları ikinci kez başlatmamalıdır.

## Failure injection

- localStorage throw
- storage estimate reject
- unsupported PerformanceObserver entry type
- feature start throw
- cleanup throw
- network offline
- visibility hidden
- queue timeout
- queue full
- malformed diagnostics state

## Release sign-off

Tüm source contract testleri, typecheck ve production build raporlanmadan release yapılmamalıdır. Browser smoke testi en az Chromium ve bir WebKit tabanlı tarayıcıyla çalıştırılmalıdır.
