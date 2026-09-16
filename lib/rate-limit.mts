// Bellek içi hız sınırlayıcı.
//
// Bu dosya projedeki ilk TypeScript modülüdür. Node 22.18+ TypeScript'i yerel
// tip sıyırma ile çalıştırdığı için derleme adımı yoktur: `npm start` bu
// dosyayı doğrudan yükler.
//
// Uzantı `.mts`, `.ts` değil. Mevcut `.mjs` kuralıyla eşleşir ve Node'a dosyanın
// ESM olduğunu açıkça söyler; `.ts` kullanmak modül türünü tahmin ettirir ve
// uyarı üretir. Bunu `package.json` içine `"type": "module"` yazarak çözmek
// mümkün değildi: `public/` altındaki UMD modülleri kontrol paketleri
// tarafından `require()` ile yükleniyor ve o bayrak onları ESM'e çevirirdi.
//
// Yalnızca silinebilir sözdizimi kullanılır (`erasableSyntaxOnly`), yani enum,
// namespace veya parametre özelliği yok.

/** Kota aşıldığında dönen karar; `retryAfterSeconds` saniye cinsindendir. */
export type RateLimitDenied = Readonly<{
  ok: false;
  retryAfterSeconds: number;
  /** Red, istek kotasından değil eşzamanlılık sınırından geliyorsa `true`. */
  concurrent?: boolean;
}>;

/** İzin verilen istek; `release()` eşzamanlılık yuvasını geri bırakır. */
export type RateLimitAllowed = Readonly<{
  ok: true;
  retryAfterSeconds?: undefined;
  concurrent?: undefined;
  release: () => void;
}>;

/**
 * `ok` bir literal olduğu için çağıran taraf tek bir karşılaştırmayla hangi
 * alanların var olduğunu görür.
 */
export type RateLimitDecision = RateLimitDenied | RateLimitAllowed;

export interface RateLimitOptions {
  /** Kota penceresi; en az 1000 ms. */
  windowMs?: number;
  /** Pencere başına izin verilen istek sayısı. */
  max?: number;
  /** Aynı anda uçuşta olabilecek istek sayısı; 0 sınırsız demektir. */
  maxConcurrent?: number;
  /** Bellekte tutulan anahtar sayısı üst sınırı. */
  maxEntries?: number;
}

interface RateLimitEntry {
  count: number;
  concurrent: number;
  resetAt: number;
}

export function createRateLimiter({
  windowMs = 60_000,
  max = 60,
  maxConcurrent = 0,
  maxEntries = 10_000
}: RateLimitOptions = {}) {
  if (!Number.isInteger(windowMs) || windowMs < 1_000) throw new Error('INVALID_RATE_LIMIT_WINDOW');
  if (!Number.isInteger(max) || max < 1) throw new Error('INVALID_RATE_LIMIT_MAX');
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 0) throw new Error('INVALID_RATE_LIMIT_CONCURRENT');

  const entries = new Map<string, RateLimitEntry>();

  function prune(now: number): void {
    if (entries.size <= maxEntries) return;
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now && entry.concurrent === 0) entries.delete(key);
    }
    while (entries.size > maxEntries) {
      const first = entries.keys().next();
      if (first.done) break;
      entries.delete(first.value);
    }
  }

  function check(key: string, now: number = Date.now()): RateLimitDecision {
    const normalizedKey = typeof key === 'string' && key ? key.slice(0, 200) : 'anonymous';
    let entry = entries.get(normalizedKey);
    if (!entry) {
      entry = { count: 0, concurrent: 0, resetAt: now + windowMs };
      entries.set(normalizedKey, entry);
    } else if (entry.resetAt <= now) {
      // Rotate the request quota without replacing the entry object: a live
      // request may still hold the old release() closure. Keeping one stable
      // object ensures its concurrent slot remains accounted for across windows.
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    if (entry.count >= max) {
      return Object.freeze({ ok: false as const, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) });
    }
    if (maxConcurrent > 0 && entry.concurrent >= maxConcurrent) {
      // A request refused because one is already in flight still consumes quota,
      // so hammering the endpoint during a slow call cannot be retried for free.
      entry.count += 1;
      return Object.freeze({ ok: false as const, retryAfterSeconds: 1, concurrent: true });
    }

    entry.count += 1;
    entry.concurrent += 1;
    prune(now);
    const live = entry;
    let released = false;
    return Object.freeze({
      ok: true as const,
      release(): void {
        if (released) return;
        released = true;
        live.concurrent = Math.max(0, live.concurrent - 1);
        if (live.count === 0 && live.concurrent === 0 && live.resetAt <= Date.now()) entries.delete(normalizedKey);
      }
    });
  }

  return Object.freeze({ check, size: () => entries.size });
}
