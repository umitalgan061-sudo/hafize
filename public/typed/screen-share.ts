import { Disposer, on, query, text } from './browser-platform.ts';

export const SCREEN_SHARE_LIMITS = Object.freeze({ maxWidth: 1280, maxHeight: 720, jpegQuality: 0.82 });
export function stopStream(stream: MediaStream | null | undefined): void { for (const track of stream?.getTracks?.() || []) { try { track.stop(); } catch {} } }
export function boundedSize(width: number, height: number): { width: number; height: number } { const safeWidth = Number.isFinite(width) && width > 0 ? width : 1; const safeHeight = Number.isFinite(height) && height > 0 ? height : 1; const scale = Math.min(1, SCREEN_SHARE_LIMITS.maxWidth / safeWidth, SCREEN_SHARE_LIMITS.maxHeight / safeHeight); return { width: Math.max(1, Math.round(safeWidth * scale)), height: Math.max(1, Math.round(safeHeight * scale)) }; }
async function waitForVideo(video: HTMLVideoElement): Promise<void> { if (video.videoWidth > 0 && video.videoHeight > 0) return; await new Promise<void>((resolve, reject) => { const ready = () => { cleanup(); resolve(); }; const error = () => { cleanup(); reject(new Error('SCREEN_CAPTURE_VIDEO_FAILED')); }; const cleanup = () => { video.removeEventListener('loadedmetadata', ready); video.removeEventListener('error', error); }; video.addEventListener('loadedmetadata', ready, { once: true }); video.addEventListener('error', error, { once: true }); }); }
async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> { const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', SCREEN_SHARE_LIMITS.jpegQuality)); if (!blob || blob.type !== 'image/jpeg') throw new Error('SCREEN_CAPTURE_ENCODE_FAILED'); return blob; }

export async function captureScreenFrame(context: { mediaDevices?: MediaDevices; document: Document; explicitUserIntent?: boolean }): Promise<{ blob: Blob; width: number; height: number; mimeType: string; metadata: Readonly<Record<string, unknown>> }> {
  if (context.explicitUserIntent !== true) throw new Error('SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT');
  if (typeof context.mediaDevices?.getDisplayMedia !== 'function') throw new Error('SCREEN_CAPTURE_UNSUPPORTED');
  let stream: MediaStream | undefined;
  try {
    stream = await context.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 1, max: 5 } }, audio: false });
    const track = stream.getVideoTracks()[0]; if (!track) throw new Error('SCREEN_CAPTURE_NO_VIDEO');
    const video = context.document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream; await video.play(); await waitForVideo(video);
    const size = boundedSize(video.videoWidth, video.videoHeight); const canvas = context.document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height; const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) throw new Error('SCREEN_CAPTURE_CANVAS_FAILED'); ctx.drawImage(video, 0, 0, size.width, size.height); const blob = await canvasToBlob(canvas); video.srcObject = null;
    return Object.freeze({ blob, width: size.width, height: size.height, mimeType: blob.type, metadata: Object.freeze({ explicitUserIntent: true, mimeType: blob.type, byteLength: blob.size, width: size.width, height: size.height }) });
  } catch (error) { const name = error instanceof DOMException ? error.name : ''; if (name === 'NotAllowedError' || name === 'AbortError') throw new Error('SCREEN_CAPTURE_CANCELLED'); throw error; } finally { stopStream(stream); }
}

export function mountScreenShare(documentRef: Document = document, rootRef: Window = window): Readonly<{ requestCapture: () => Promise<boolean>; clearCapture: () => void; getCapture: () => Blob | null; destroy: () => void }> | null {
  const button = query<HTMLButtonElement>(documentRef, '#screenShareBtn'); const panel = query<HTMLElement>(documentRef, '#screenSharePreview'); const image = query<HTMLImageElement>(documentRef, '#screenShareImage'); const status = query<HTMLElement>(documentRef, '#screenShareStatus'); const remove = query<HTMLButtonElement>(documentRef, '#screenShareRemove'); if (!button || !panel || !image || !status || !remove) return null;
  const disposer = new Disposer(); let objectUrl = ''; let current: Blob | null = null;
  const clearCapture = () => { if (objectUrl) rootRef.URL.revokeObjectURL(objectUrl); objectUrl = ''; current = null; image.removeAttribute('src'); panel.hidden = true; button.setAttribute('aria-pressed','false'); status.textContent = 'Ekran görüntüsü tutulmuyor.'; };
  const requestCapture = async () => { if (button.disabled) return false; button.disabled = true; status.textContent = 'Paylaşılacak pencere veya ekranı sen seçiyorsun…'; try { const result = await captureScreenFrame({ mediaDevices: rootRef.navigator.mediaDevices, document: documentRef, explicitUserIntent: true }); clearCapture(); current = result.blob; objectUrl = rootRef.URL.createObjectURL(result.blob); image.src = objectUrl; panel.hidden = false; button.setAttribute('aria-pressed','true'); status.textContent = `${result.width}×${result.height} ekran görüntüsü yalnız bu sekmede hazır; Hafize’ye gönderilmedi.`; rootRef.dispatchEvent(new CustomEvent('hafize:screen-capture-ready', { detail: result.metadata })); return true; } catch (error) { status.textContent = (error as Error).message === 'SCREEN_CAPTURE_CANCELLED' ? 'Ekran paylaşımı iptal edildi.' : (error as Error).message === 'SCREEN_CAPTURE_UNSUPPORTED' ? 'Bu tarayıcı ekran paylaşımını desteklemiyor.' : 'Ekran görüntüsü alınamadı.'; return false; } finally { button.disabled = false; } };
  on(button,'click',()=>void requestCapture(),undefined,disposer); on(remove,'click',clearCapture,undefined,disposer); on(rootRef,'pagehide',clearCapture,{ once: true },disposer);
  return Object.freeze({ requestCapture, clearCapture, getCapture: () => current, destroy: () => { clearCapture(); disposer.flush(); } });
}

const start=()=>mountScreenShare(document,window); if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
