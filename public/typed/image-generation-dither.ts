/**
 * Hafize image generation dither field animation.
 * Ported from beUI ImageGeneration/DitherField with Hafize architecture.
 * Runs inside the actual chat message card, same aspect ratio as generated image.
 * No React/Motion dependency - vanilla TS/CSS with RAF.
 */
(() => {
  'use strict';

  type ImageGenerationStatus = 'queued' | 'generating' | 'refining' | 'complete' | 'error';
  type ImageGenerationMessages = {
    queued: string;
    generating: string;
    refining: string;
    complete: string;
    error: string;
    labelWithPrompt: string;
    quotedPrompt: string;
    retry: string;
  };

  const DEFAULT_MESSAGES: ImageGenerationMessages = {
    queued: 'Sıraya alındı',
    generating: 'Görsel oluşturuluyor',
    refining: 'Detaylar işleniyor',
    complete: 'Görsel hazır',
    error: 'Oluşturma başarısız',
    labelWithPrompt: '{status}: {prompt}',
    quotedPrompt: '“{prompt}”',
    retry: 'Tekrar dene'
  };

  const DOT_GAP = 10;
  const TWO_PI = Math.PI * 2;
  const OVERLAY_OPACITY: Record<ImageGenerationStatus, number> = {
    queued: 1,
    generating: 1,
    refining: 0.48,
    complete: 0,
    error: 0
  };
  const MEDIA_STATE: Record<ImageGenerationStatus, { filter: string; opacity: number; scale: number }> = {
    queued: { filter: 'blur(4px) saturate(0.75)', opacity: 0, scale: 1.02 },
    generating: { filter: 'blur(3px) saturate(0.85)', opacity: 0, scale: 1.015 },
    refining: { filter: 'blur(1.5px) saturate(0.95)', opacity: 0.62, scale: 1.005 },
    complete: { filter: 'blur(0px) saturate(1)', opacity: 1, scale: 1 },
    error: { filter: 'blur(2px) saturate(0.5)', opacity: 0.28, scale: 1 }
  };

  interface DitherFieldOptions {
    status: ImageGenerationStatus;
    interactive: boolean;
    reduceMotion: boolean;
    container: HTMLElement;
    onResize?: () => void;
  }

  interface DitherFieldController {
    destroy: () => void;
    setStatus: (status: ImageGenerationStatus) => void;
    setInteractive: (interactive: boolean) => void;
    setReduceMotion: (reduce: boolean) => void;
  }

  function createDitherField(options: DitherFieldOptions): DitherFieldController {
    const { container, status: initialStatus, interactive: initialInteractive, reduceMotion: initialReduce } = options;
    let status = initialStatus;
    let interactive = initialInteractive;
    let reduceMotion = initialReduce;
    let frame = 0;
    let width = 0;
    let height = 0;
    let dotColor = 'currentColor';
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, inside: false };
    let canvas: HTMLCanvasElement | null = null;
    let context: CanvasRenderingContext2D | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let pointerMoveHandler: ((event: PointerEvent) => void) | null = null;
    let pointerLeaveHandler: (() => void) | null = null;
    let destroyed = false;

    const overlay = document.createElement('div');
    overlay.className = 'hz-img-gen-dither-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = 'position:absolute;inset:0;overflow-hidden;background:var(--muted, currentColor);opacity:0;transition:opacity 0.4s ease-out;pointer-events:none;';
    container.appendChild(overlay);

    const canvasEl = document.createElement('canvas');
    canvasEl.className = 'hz-img-gen-dither-canvas';
    canvasEl.setAttribute('aria-hidden', 'true');
    canvasEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;color:inherit;';
    overlay.appendChild(canvasEl);
    canvas = canvasEl;

    const marker = document.createElement('div');
    marker.className = 'hz-img-gen-dither-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;';
    overlay.appendChild(marker);

    function getCanHover(): boolean {
      if (typeof window === 'undefined') return false;
      if (window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) return false;
      if (window.matchMedia?.('(pointer: coarse)').matches) return false;
      return true;
    }

    const canHover = getCanHover();

    function updateDotColor() {
      if (!canvas) return;
      dotColor = getComputedStyle(canvas).color || 'currentColor';
    }

    function resize() {
      if (!canvas || destroyed) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width || canvas.clientWidth || 208;
      height = rect.height || canvas.clientHeight || 208;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context = canvas.getContext('2d');
      if (context) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      updateDotColor();
      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.targetX = pointer.x;
      pointer.targetY = pointer.y;
      if (reduceMotion) draw(0);
      options.onResize?.();
    }

    function draw(time: number) {
      if (!context || destroyed || !canvas) return;
      context.clearRect(0, 0, width, height);
      if (!pointer.inside) {
        pointer.targetX = width / 2 + (reduceMotion ? 0 : Math.sin(time / 1700) * width * 0.12);
        pointer.targetY = height / 2 + (reduceMotion ? 0 : Math.cos(time / 2100) * height * 0.1);
      }
      const follow = reduceMotion ? 1 : pointer.inside ? 0.16 : 0.045;
      pointer.x += (pointer.targetX - pointer.x) * follow;
      pointer.y += (pointer.targetY - pointer.y) * follow;
      const radius = Math.min(width, height) * 0.38;
      const columns = Math.ceil(width / DOT_GAP) + 1;
      const rows = Math.ceil(height / DOT_GAP) + 1;
      const offsetX = (width - (columns - 1) * DOT_GAP) / 2;
      const offsetY = (height - (rows - 1) * DOT_GAP) / 2;
      context.fillStyle = dotColor;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          const anchorX = offsetX + col * DOT_GAP;
          const anchorY = offsetY + row * DOT_GAP;
          const deltaX = anchorX - pointer.x;
          const deltaY = anchorY - pointer.y;
          const distance = Math.hypot(deltaX, deltaY);
          const proximity = Math.max(0, 1 - distance / radius);
          const influence = proximity * proximity * (3 - 2 * proximity);
          const displacement = influence * influence * 9;
          const directionX = distance > 0 ? deltaX / distance : 0;
          const directionY = distance > 0 ? deltaY / distance : 0;
          const x = anchorX + directionX * displacement;
          const y = anchorY + directionY * displacement;
          const dotRadius = 0.65 + influence * 0.85;
          context.globalAlpha = 0.17 + influence * 0.72;
          context.beginPath();
          context.arc(x, y, dotRadius, 0, TWO_PI);
          context.fill();
        }
      }
      context.globalAlpha = 1;
      if (!reduceMotion && !destroyed) frame = requestAnimationFrame(draw);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!interactive || !canHover || reduceMotion || destroyed) return;
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      pointer.inside = true;
      pointer.targetX = event.clientX - rect.left;
      pointer.targetY = event.clientY - rect.top;
    }

    function handlePointerLeave() {
      pointer.inside = false;
    }

    function updateOverlayOpacity() {
      overlay.style.opacity = String(OVERLAY_OPACITY[status]);
    }

    function updateMarker() {
      marker.innerHTML = '';
      if (status === 'complete') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'width:1.5rem;height:1.5rem;color:var(--hz-success,#276749);';
        svg.innerHTML = '<path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
        marker.appendChild(svg);
      } else if (status === 'error') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'width:1.5rem;height:1.5rem;color:var(--hz-danger,#a32935);';
        svg.innerHTML = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" fill="none"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>';
        marker.appendChild(svg);
      } else {
        const rotating = document.createElement('div');
        rotating.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem;place-items:center;width:1.5rem;height:1.5rem;animation:rotate 2.4s linear infinite;';
        if (reduceMotion) rotating.style.animation = 'none';
        for (let i = 0; i < 4; i++) {
          const dot = document.createElement('span');
          dot.style.cssText = `width:0.25rem;height:0.25rem;border-radius:2px;background:currentColor;${i === 1 || i === 2 ? 'opacity:0.55' : ''}`;
          rotating.appendChild(dot);
        }
        marker.appendChild(rotating);
      }
    }

    function init() {
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas!);
      pointerMoveHandler = handlePointerMove;
      pointerLeaveHandler = handlePointerLeave;
      canvas?.addEventListener('pointermove', pointerMoveHandler, { passive: true });
      canvas?.addEventListener('pointerleave', pointerLeaveHandler);
      draw(0);
      updateOverlayOpacity();
      updateMarker();
    }

    function setStatus(newStatus: ImageGenerationStatus) {
      status = newStatus;
      updateOverlayOpacity();
      updateMarker();
    }

    function setInteractive(newInteractive: boolean) {
      interactive = newInteractive;
    }

    function setReduceMotion(reduce: boolean) {
      reduceMotion = reduce;
      if (reduce) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        draw(0);
      } else if (!frame) {
        draw(0);
      }
      updateMarker();
    }

    function destroy() {
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      canvas?.removeEventListener('pointermove', pointerMoveHandler!);
      canvas?.removeEventListener('pointerleave', pointerLeaveHandler!);
      overlay.remove();
    }

    init();

    return { destroy, setStatus, setInteractive, setReduceMotion };
  }

  // Expose for message renderer
  (globalThis as typeof globalThis & { HafizeImageGeneration?: { createDitherField: typeof createDitherField; DEFAULT_MESSAGES: typeof DEFAULT_MESSAGES } }).HafizeImageGeneration = Object.freeze({
    createDitherField,
    DEFAULT_MESSAGES
  });

  // CSS keyframes for rotating marker
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rotate { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .hz-img-gen-dither-marker > div { animation: none !important; }
    }
    html[data-reduced-motion="true"] .hz-img-gen-dither-marker > div { animation: none !important; }
  `;
  document.head.appendChild(style);
})();