// Hafize HTTP istek hatası sınırı.
//
// Neden: server.mjs içindeki üst düzey `catch` bloğu her hatayı `sendJson` ile
// yanıtlıyordu. `sendJson` önce `res.setHeader` çağırır; yanıt akışı zaten
// başlamışsa (SSE ile araç etkinliği yayınlayan `/api/agent/run` yolu) bu çağrı
// `ERR_HTTP_HEADERS_SENT` fırlatır. Hata, async istek işleyicisinin içinde
// oluştuğu için yakalanmadan kalır ve Node 22 varsayılanında süreç düşer:
// tek bir bozuk akış tüm sunucuyu kapatabilir.
//
// Bu modül hatayı önce sınıflandırır, sonra yanıtın gerçek durumuna göre
// güvenli olan tek teslim biçimini seçer:
//   - yanıt kapanmışsa            → hiçbir şey yazılmaz
//   - başlıklar gönderilmemişse   → JSON gövde
//   - akış başlamışsa             → SSE hata çerçevesi (`data: {"error":...}`)
//
// Teslim yolunun kendisi asla fırlatmaz; hata sınırının hata üretmesi ilk
// sorunu yeniden yaratırdı.

const MAX_DETAIL_CHARS = 1200;

// İstemci bağlantıyı kopardığında yazılacak bir alıcı kalmaz. Bunlar hata
// olarak raporlanmaz, sessizce kapatılır.
const CLIENT_GONE_CODES = new Set([
  'ABORT_ERR',
  'ECONNRESET',
  'EPIPE',
  'ERR_STREAM_PREMATURE_CLOSE',
  'ERR_STREAM_DESTROYED'
]);

function detailText(value) {
  if (typeof value !== 'string' || !value) return '';
  return value.slice(0, MAX_DETAIL_CHARS);
}

function statusOr(error, fallback) {
  return Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : fallback;
}

/**
 * Hatayı istemciye dönecek duruma ve gövdeye eşler.
 *
 * Bilinmeyen hatalar her zaman `INTERNAL_ERROR` olur: `error.message` içeriği
 * yol, secret veya yığın izi taşıyabileceği için dışarı sızdırılmaz.
 */
export function classifyRequestFailure(error) {
  if (error?.name === 'AbortError' || CLIENT_GONE_CODES.has(error?.code)) {
    return { silent: true, status: 0, body: null };
  }
  const message = typeof error?.message === 'string' ? error.message : '';
  switch (message) {
    case 'BODY_TOO_LARGE':
      return { silent: false, status: 413, body: { error: 'BODY_TOO_LARGE' } };
    case 'NVIDIA_NOT_CONFIGURED':
      return { silent: false, status: 503, body: { error: 'NVIDIA_NOT_CONFIGURED' } };
    case 'NVIDIA_CHAT_ERROR':
      return {
        silent: false,
        status: statusOr(error, 502),
        body: { error: 'NVIDIA_CHAT_ERROR', detail: detailText(error?.detail) }
      };
    case 'INVALID_NVIDIA_RESPONSE':
      return { silent: false, status: statusOr(error, 502), body: { error: 'INVALID_NVIDIA_RESPONSE' } };
    default:
      break;
  }
  if (error instanceof SyntaxError) {
    return { silent: false, status: 400, body: { error: 'INVALID_JSON' } };
  }
  return { silent: false, status: 500, body: { error: 'INTERNAL_ERROR' } };
}

/**
 * Sınıflandırılmış hatayı yanıtın durumuna uygun biçimde teslim eder.
 *
 * @returns {'closed'|'aborted'|'json'|'stream'} seçilen teslim yolu.
 */
export function deliverRequestFailure(res, error, { sendJson } = {}) {
  if (typeof sendJson !== 'function') throw new Error('INVALID_REQUEST_FAILURE:sendJson');
  const classification = classifyRequestFailure(error);
  try {
    if (!res || res.writableEnded || res.destroyed) return 'closed';
    if (classification.silent) {
      if (res.headersSent) res.end();
      return 'aborted';
    }
    if (!res.headersSent) {
      sendJson(res, classification.status, classification.body);
      return 'json';
    }
    // Akış başlamış: durum kodu artık değiştirilemez. İstemci `app.js` içinde
    // `data:` çerçevesindeki `error` alanını okuyup akışı sonlandırır.
    res.write(`data: ${JSON.stringify(classification.body)}\n\n`);
    res.end();
    return 'stream';
  } catch {
    // Teslim başarısızsa yapılabilecek tek güvenli iş bağlantıyı kapatmaktır.
    try {
      res?.end();
    } catch {
      /* yanıt zaten yok */
    }
    return 'closed';
  }
}
