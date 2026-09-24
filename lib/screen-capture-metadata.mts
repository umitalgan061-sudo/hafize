const FIELDS = new Set(['explicitUserIntent', 'mimeType', 'byteLength', 'width', 'height']);
const LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, width: 1280, height: 720 });

/** Doğrulanmış ekran görüntüsü üst verisi. */
export type ScreenCaptureMetadata = Readonly<{
  mimeType: 'image/jpeg';
  byteLength: number;
  width: number;
  height: number;
}>;

/**
 * Doğrulama sonucu.
 *
 * `ok` literal yazılır: çağıran taraf tek bir `result.ok === false`
 * karşılaştırmasıyla hangi alanın var olduğunu görür. `boolean`'a genişlerse
 * daraltma çalışmaz ve `result.metadata` erişimi hata verir.
 */
export type ScreenCaptureResult =
  | { readonly ok: false; readonly error: string }
  | { readonly ok: true; readonly metadata: ScreenCaptureMetadata };

function fail(error: string): ScreenCaptureResult { return { ok: false as const, error }; }

// Girdi bir sınır değeridir: çağıran taraf ne verirse versin fonksiyon kendi
// doğrulamasını yapar, bu yüzden imza `unknown` alır. Şekil kontrolünden
// sonra tek bir daraltma yapılır; alan erişimleri ondan sonra gelir.
export function normalizeScreenCaptureMetadata(value: unknown): ScreenCaptureResult {
  if (!value || Array.isArray(value) || typeof value !== 'object') return fail('INVALID_SCREEN_CAPTURE:input');
  const input = value as UnvalidatedInput;
  for (const key of Object.keys(input)) {
    if (!FIELDS.has(key)) return fail('INVALID_SCREEN_CAPTURE:field');
  }
  if (input.explicitUserIntent !== true) return fail('SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT');
  if (input.mimeType !== 'image/jpeg') return fail('SCREEN_CAPTURE_UNSUPPORTED_MIME');
  if (!Number.isInteger(input.byteLength) || input.byteLength < 1 || input.byteLength > LIMITS.bytes) {
    return fail('SCREEN_CAPTURE_INVALID_SIZE');
  }
  if (!Number.isInteger(input.width) || input.width < 1 || input.width > LIMITS.width) {
    return fail('SCREEN_CAPTURE_INVALID_DIMENSIONS');
  }
  if (!Number.isInteger(input.height) || input.height < 1 || input.height > LIMITS.height) {
    return fail('SCREEN_CAPTURE_INVALID_DIMENSIONS');
  }
  return { ok: true as const, metadata: Object.freeze({
    mimeType: 'image/jpeg',
    byteLength: input.byteLength,
    width: input.width,
    height: input.height
  }) };
}

export const SCREEN_CAPTURE_LIMITS = LIMITS;
