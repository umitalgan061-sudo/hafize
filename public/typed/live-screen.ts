// Live screen sharing. The browser keeps the shared picture on this device: a frame only leaves when
// the picture has really changed (rate-limited) or when the user sends a message, and the server
// turns it into text without storing it. Phone browsers offer no screen capture at all, so there
// the same pipeline can run on the camera instead.
export {};

type Source = 'screen' | 'camera';

const MAX_FRAME_WIDTH = 1600;
const JPEG_QUALITY = 0.72;
const SAMPLE_MS = 1_000;
const MIN_FRAME_GAP_MS = 12_000;
// Share of pixels that must change. A screen is still until a line of text moves; a camera never is.
const CHANGE_THRESHOLD: Readonly<Record<Source, number>> = Object.freeze({ screen: 0.4, camera: 6 });
const PIXEL_DELTA = 18;
const ASK_TIMEOUT_MS = 20_000;
const SIGNATURE_WIDTH = 96;
const SIGNATURE_HEIGHT = 54;

/** Percentage of pixels that visibly differ between two RGBA buffers of the same size. */
export function frameDifference(a: ArrayLike<number> | null, b: ArrayLike<number> | null): number {
  if (!a || !b || a.length !== b.length || !a.length) return 100;
  let changed = 0;
  for (let index = 0; index < a.length; index += 4) {
    if (Math.max(Math.abs(a[index]! - b[index]!), Math.abs(a[index + 1]! - b[index + 1]!), Math.abs(a[index + 2]! - b[index + 2]!)) > PIXEL_DELTA) changed += 1;
  }
  return (changed / (a.length / 4)) * 100;
}

export function frameSize(width: number, height: number, max = MAX_FRAME_WIDTH): { width: number; height: number } {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const scale = Math.min(1, max / safeWidth);
  return { width: Math.max(1, Math.round(safeWidth * scale)), height: Math.max(1, Math.round(safeHeight * scale)) };
}

export function shouldSendFrame({ difference, lastSentAt, now, busy, source = 'screen' }: { readonly difference: number; readonly lastSentAt: number; readonly now: number; readonly busy: boolean; readonly source?: Source }): boolean {
  return !busy && now - lastSentAt >= MIN_FRAME_GAP_MS && difference >= CHANGE_THRESHOLD[source];
}

/** What the device can do: decides between the system picker and the camera offer. */
export function captureSupport(root: { isSecureContext?: boolean; navigator?: { mediaDevices?: { getDisplayMedia?: unknown; getUserMedia?: unknown } } }): { secure: boolean; screen: boolean; camera: boolean } {
  const devices = root.navigator?.mediaDevices;
  return { secure: root.isSecureContext === true, screen: typeof devices?.getDisplayMedia === 'function', camera: typeof devices?.getUserMedia === 'function' };
}

function install(documentRef: Document, root: typeof globalThis): void {
  const button = documentRef.querySelector<HTMLButtonElement>('#liveScreenBtn');
  const composer = documentRef.querySelector<HTMLElement>('#composer');
  if (!button || !composer) return;

  const api = (path: string, init?: RequestInit) => ((root as typeof globalThis & { HafizeAuth?: { fetch: typeof fetch } }).HafizeAuth?.fetch ?? root.fetch.bind(root))(path, init);
  const toast = (message: string) => {
    const node = documentRef.querySelector<HTMLElement>('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.remove('hidden');
    root.setTimeout(() => { if (node.textContent === message) node.classList.add('hidden'); }, 6000);
  };

  let stream: MediaStream | null = null;
  let chip: HTMLElement | null = null;
  let statusLine: HTMLElement | null = null;
  let video: HTMLVideoElement | null = null;
  let source: Source = 'screen';
  let sampler: ReturnType<typeof setInterval> | null = null;
  let signature: Uint8ClampedArray | null = null;
  let lastSentAt = 0;
  let busy = false;
  const small = documentRef.createElement('canvas');
  small.width = SIGNATURE_WIDTH;
  small.height = SIGNATURE_HEIGHT;
  const large = documentRef.createElement('canvas');

  const setStatus = (text: string) => { if (statusLine) statusLine.textContent = text; };
  const readSignature = (): Uint8ClampedArray | null => {
    if (!video?.videoWidth) return null;
    const context = small.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    return context.getImageData(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT).data;
  };
  const encodeFrame = (): string | null => {
    if (!video?.videoWidth) return null;
    const size = frameSize(video.videoWidth, video.videoHeight);
    large.width = size.width;
    large.height = size.height;
    const context = large.getContext('2d', { alpha: false });
    if (!context) return null;
    context.drawImage(video, 0, 0, size.width, size.height);
    return large.toDataURL('image/jpeg', JPEG_QUALITY);
  };
  const sendFrame = async (question = ''): Promise<boolean> => {
    const data = encodeFrame();
    if (!data) return false;
    signature = readSignature();
    lastSentAt = Date.now();
    const response = await api('/api/screen/frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, question }) });
    return response.ok;
  };
  const sample = () => {
    if (busy || !stream) return;
    const current = readSignature();
    if (!shouldSendFrame({ difference: frameDifference(signature, current), lastSentAt, now: Date.now(), busy, source })) return;
    busy = true;
    void sendFrame().then((ok) => {
      setStatus(ok ? 'Görüntü güncel' : 'Görüntü okunamadı, yeniden denenecek');
    }).catch(() => setStatus('Bağlantı kesildi, yeniden denenecek')).finally(() => { busy = false; });
  };

  const stop = (notify = true) => {
    if (sampler) clearInterval(sampler);
    sampler = null;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    if (video) video.srcObject = null;
    video = null;
    chip?.remove();
    chip = null;
    signature = null;
    lastSentAt = 0;
    button.setAttribute('aria-pressed', 'false');
    composer.removeAttribute('data-live-screen');
    if (notify) void api('/api/screen', { method: 'DELETE' }).catch(() => {});
  };

  const buildChip = () => {
    chip = documentRef.createElement('div');
    chip.className = 'live-screen-chip';
    chip.setAttribute('role', 'status');
    video = documentRef.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    const text = documentRef.createElement('div');
    text.className = 'live-screen-text';
    const title = documentRef.createElement('strong');
    title.textContent = source === 'camera' ? 'Canlı · Hafize kamerayı görüyor' : 'Canlı · Hafize ekranını görüyor';
    statusLine = documentRef.createElement('span');
    statusLine.textContent = 'Görüntü okunuyor…';
    text.append(title, statusLine);
    const stopButton = documentRef.createElement('button');
    stopButton.type = 'button';
    stopButton.className = 'live-screen-stop';
    stopButton.textContent = 'Durdur';
    stopButton.addEventListener('click', () => stop());
    chip.append(video, text, stopButton);
    composer.prepend(chip);
  };

  const start = async (kind: Source) => {
    const devices = root.navigator.mediaDevices;
    try {
      stream = kind === 'screen'
        ? await devices.getDisplayMedia({ video: { frameRate: { ideal: 2, max: 5 } }, audio: false })
        : await devices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
    } catch (error) {
      stream = null;
      if ((error as Error)?.name !== 'NotAllowedError' && (error as Error)?.name !== 'AbortError') toast('Görüntü paylaşımı başlatılamadı.');
      return;
    }
    source = kind;
    buildChip();
    video!.srcObject = stream;
    await video!.play().catch(() => {});
    stream.getVideoTracks()[0]?.addEventListener('ended', () => stop());
    button.setAttribute('aria-pressed', 'true');
    composer.setAttribute('data-live-screen', 'true');
    toast('Görüntüler analiz için NVIDIA’ya gider, kaydedilmez. Parola gibi bilgileri ekranda açık bırakma.');
    // A reload ends sharing without a goodbye; descriptions from then must not read as the present.
    await api('/api/screen', { method: 'DELETE' }).catch(() => {});
    await new Promise((done) => root.setTimeout(done, 300));
    busy = true;
    void sendFrame().then((ok) => setStatus(ok ? 'Görüntü güncel' : 'Görüntü okunamadı, yeniden denenecek')).catch(() => setStatus('Bağlantı kesildi, yeniden denenecek')).finally(() => { busy = false; });
    sampler = setInterval(sample, SAMPLE_MS);
  };

  const offerCamera = (support: { camera: boolean }) => {
    const dialog = documentRef.createElement('dialog');
    dialog.className = 'live-screen-sheet';
    const title = documentRef.createElement('h2');
    title.textContent = 'Bu cihazın tarayıcısı ekran paylaşımı sunmuyor';
    const text = documentRef.createElement('p');
    text.textContent = 'Telefon tarayıcıları web uygulamalarına ekran yayını vermiyor. Telefonu bilgisayara yansıtıp (Telefon Bağlantısı, scrcpy) o pencereyi masaüstünden paylaşabilir ya da kamerayla göstermek istediğin şeyi canlı gösterebilirsin.';
    const actions = documentRef.createElement('div');
    actions.className = 'live-screen-sheet-actions';
    const close = documentRef.createElement('button');
    close.type = 'button';
    close.className = 'soft-btn';
    close.textContent = 'Kapat';
    close.addEventListener('click', () => dialog.close());
    actions.append(close);
    if (support.camera) {
      const camera = documentRef.createElement('button');
      camera.type = 'button';
      camera.className = 'live-screen-primary';
      camera.textContent = 'Kamerayla göster';
      camera.addEventListener('click', () => { dialog.close(); void start('camera'); });
      actions.append(camera);
    }
    dialog.append(title, text, actions);
    dialog.addEventListener('close', () => dialog.remove());
    documentRef.body.append(dialog);
    dialog.showModal();
  };

  button.addEventListener('click', () => {
    if (stream) { stop(); return; }
    const support = captureSupport(root);
    if (!support.secure) { toast('Görüntü paylaşımı güvenli bağlantı ister. Ayarlar > Uygulamayı yükle bölümündeki HTTPS adresini kullan.'); return; }
    if (support.screen) void start('screen');
    else offerCamera(support);
  });
  root.addEventListener('pagehide', () => { if (stream) stop(false); });

  (root as typeof globalThis & { HafizeLiveScreen?: unknown }).HafizeLiveScreen = Object.freeze({
    /** Called right before a message goes out, so the answer is about what is on screen now. */
    async beforeSend(question: string): Promise<void> {
      if (!stream) return;
      setStatus(source === 'camera' ? 'Kameraya bakıyor…' : 'Ekrana bakıyor…');
      const timeout = new Promise<boolean>((done) => root.setTimeout(() => done(false), ASK_TIMEOUT_MS));
      const ok = await Promise.race([sendFrame(question).catch(() => false), timeout]);
      setStatus(ok ? 'Görüntü güncel' : 'Görüntü okunamadı, son bilinen hâli kullanılıyor');
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(document, globalThis), { once: true });
  else install(document, globalThis);
}
