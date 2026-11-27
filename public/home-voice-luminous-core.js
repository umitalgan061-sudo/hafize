/* Hafize portrait stage: the living image on the home "Sesli asistan" card.
 * Hafize designs this image itself in its mirror (see lib/self-portrait.ts):
 * the published look is public/hafize-self-portrait.json, one GLSL ES 1.00
 * function `vec4 hafizePortrait(vec2 p)` that this stage wraps in a fixed
 * shader and animates with the voice card's state classes (idle, listening,
 * thinking, speaking). Without a published portrait, or if it cannot compile,
 * the original Canvas 2D dot sphere is drawn.
 * It also exposes window.HafizePortrait so the mirror can compile, preview and
 * photograph candidate looks. Shaders cannot reach the DOM, storage or network;
 * the only request here is the same-origin portrait data file. Reduced motion
 * draws one still frame; hidden or off-screen it does not render. The
 * full-screen voice orb (voice-orb.ts / voice-visual.ts) is not touched.
 */
(() => {
  const orb = document.querySelector('.main .utility-rail .voice-card .voice-orb');
  if (!orb || orb.querySelector('canvas.hz-luminous-core')) return;
  const card = orb.closest('.voice-card');
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const STATES = ['idle', 'listening', 'thinking', 'speaking'];
  const ENERGY = { idle: 0.14, listening: 0.62, thinking: 0.48, speaking: 0.9 };
  const UNIFORMS = ['uRes', 'uTime', 'uFlow', 'uEnergy', 'uListen', 'uThink', 'uSpeak', 'uVoice', 'uLight', 'uPx'];
  const VERTEX = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';
  const motionOff = () => reduced.matches || root.dataset.reducedMotion === 'true';
  const lightTheme = () => root.dataset.theme === 'light';
  const cardState = () => card.classList.contains('speaking') ? 'speaking'
    : card.classList.contains('listening') ? 'listening'
    : card.classList.contains('thinking') ? 'thinking' : 'idle';

  // The exact wrapper of lib/self-portrait.ts portraitShaderSource().
  function shaderSource(glsl) {
    return ['#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
      'uniform vec2 uRes;', 'uniform float uTime;', 'uniform float uFlow;', 'uniform float uEnergy;', 'uniform float uListen;',
      'uniform float uThink;', 'uniform float uSpeak;', 'uniform float uVoice;', 'uniform float uLight;', 'uniform float uPx;',
      '#line 1', glsl, 'void main(){', '  float s=0.5*min(uRes.x,uRes.y);',
      '  vec4 c=clamp(hafizePortrait((gl_FragCoord.xy-0.5*uRes)/s),0.0,1.0);', '  gl_FragColor=vec4(c.rgb*c.a,c.a);', '}'].join('\n');
  }

  // Compiles a portrait on a canvas. Returns { ok, log } or a renderer.
  function glPortrait(canvas, glsl, preserve) {
    let gl = null;
    const options = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: Boolean(preserve), powerPreference: 'low-power' };
    try { gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options); } catch { gl = null; }
    if (!gl) return { ok: false, log: 'WEBGL_UNAVAILABLE' };
    const shader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return { shader: s };
      const log = String(gl.getShaderInfoLog(s) || 'COMPILE_FAILED');
      gl.deleteShader(s);
      return { log };
    };
    if (typeof glsl !== 'string' || !/hafizePortrait/.test(glsl)) return { ok: false, log: 'NO_PORTRAIT' };
    const vs = shader(gl.VERTEX_SHADER, VERTEX);
    const fs = shader(gl.FRAGMENT_SHADER, shaderSource(glsl));
    if (!vs.shader || !fs.shader) { if (vs.shader) gl.deleteShader(vs.shader); if (fs.shader) gl.deleteShader(fs.shader); return { ok: false, log: fs.log || vs.log }; }
    const program = gl.createProgram();
    gl.attachShader(program, vs.shader);
    gl.attachShader(program, fs.shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = String(gl.getProgramInfoLog(program) || 'LINK_FAILED');
      gl.deleteProgram(program); gl.deleteShader(vs.shader); gl.deleteShader(fs.shader);
      return { ok: false, log };
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]));
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    return {
      ok: true, name: 'portrait',
      draw(t, mix, width, height, light) {
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const set = (name, value) => { if (uniform[name]) gl.uniform1f(uniform[name], value); };
        if (uniform.uRes) gl.uniform2f(uniform.uRes, width, height);
        set('uTime', t); set('uFlow', mix.flow); set('uEnergy', mix.energy);
        set('uListen', mix.listening); set('uThink', mix.thinking); set('uSpeak', mix.speaking); set('uVoice', mix.voice);
        set('uLight', light ? 1 : 0); set('uPx', 2 / Math.max(1, Math.min(width, height)));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      lost: () => gl.isContextLost(),
      dispose() {
        try { gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vs.shader); gl.deleteShader(fs.shader); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
      }
    };
  }

  // Canvas 2D fallback: the original lit dot sphere.
  function dotSphere(canvas) {
    let ctx;
    try { ctx = canvas.getContext('2d', { alpha: true }); } catch { ctx = null; }
    if (!ctx) return null;
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const points = Array.from({ length: 920 }, (_, i) => {
      const y = 1 - 2 * (i + 0.5) / 920;
      const a = i * GOLDEN;
      const r = Math.sqrt(1 - y * y);
      return { x: r * Math.cos(a), y, z: r * Math.sin(a), phase: i * 2.399963 };
    });
    return {
      ok: true, name: 'canvas',
      draw(t, mix, deviceWidth, deviceHeight, light, dpr) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const width = deviceWidth / dpr, height = deviceHeight / dpr, energy = mix.energy;
        const cx = width / 2, cy = height / 2, unit = Math.min(width, height);
        const spin = t * 0.24, tilt = 0.39 + 0.12 * Math.sin(t * 0.48);
        const radius = unit * 0.343 * (1 + 0.018 * Math.sin(t * 1.2) + energy * 0.028 * Math.sin(t * 4.1));
        ctx.clearRect(0, 0, width, height);
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.49);
        glow.addColorStop(0, light ? 'rgba(190,75,28,.10)' : 'rgba(255,133,74,.16)');
        glow.addColorStop(1, 'rgba(225,108,54,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        const projected = points.map((p) => {
          const wave = Math.sin(p.y * 10 + p.phase * 0.12 - t * (1.1 + energy * 1.4));
          const displacement = 1 + (0.018 + energy * 0.025) * wave;
          const x = p.x * Math.cos(spin) + p.z * Math.sin(spin);
          const z0 = p.z * Math.cos(spin) - p.x * Math.sin(spin);
          const y = p.y * Math.cos(tilt) - z0 * Math.sin(tilt);
          const z = p.y * Math.sin(tilt) + z0 * Math.cos(tilt);
          const perspective = 1 / (1 - z * 0.16);
          return { x: cx + x * radius * perspective * displacement, y: cy + y * radius * perspective * displacement, z, light: Math.max(0, -0.45 * x - 0.55 * y + 0.68 * z) };
        }).sort((a, b) => a.z - b.z);
        for (const p of projected) {
          const depth = (p.z + 1) / 2;
          const band = Math.pow(Math.max(0, Math.cos((p.y - cy) / radius * 7 + (p.x - cx) / radius * 3 - t * (1.3 + energy))), 9);
          const luminous = Math.min(1, 0.12 + p.light * 0.75 + band * 0.37);
          const size = unit * (0.003 + 0.0046 * depth + 0.0016 * band);
          const alpha = (0.13 + 0.72 * depth) * (0.66 + 0.34 * luminous);
          const red = light ? Math.round(174 + 55 * luminous) : 255;
          const green = Math.round((light ? 57 : 112) + (light ? 89 : 118) * luminous);
          const blue = Math.round((light ? 27 : 61) + (light ? 84 : 141) * luminous);
          ctx.fillStyle = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      lost: () => false,
      dispose() {}
    };
  }

  // Smoothly blended state weights; the speaking "voice" is a syllable-like envelope.
  function createMix() {
    const mix = { flow: 3.2, energy: 0.14, idle: 1, listening: 0, thinking: 0, speaking: 0, voice: 0.6 };
    let voiceTarget = 0.6, nextSyllable = 0, clock = 0;
    mix.settle = (state, dt, instant) => {
      clock += dt;
      const k = instant ? 1 : 1 - Math.exp(-dt * 4.2);
      for (const name of STATES) mix[name] += ((state === name ? 1 : 0) - mix[name]) * k;
      mix.energy += (ENERGY[state] - mix.energy) * k;
      if (state === 'speaking') {
        if (clock >= nextSyllable) { voiceTarget = 0.35 + Math.random() * 0.65; nextSyllable = clock + 0.09 + Math.random() * 0.12; }
      } else voiceTarget = 0.6;
      mix.voice += (voiceTarget - mix.voice) * (instant ? 1 : 1 - Math.exp(-dt * 14));
      // Flow clock: drifting motion runs faster with energy and while thinking.
      mix.flow += dt * (0.42 + 0.9 * mix.energy + 0.9 * mix.thinking);
    };
    return mix;
  }
  const settled = (state) => {
    const mix = createMix();
    mix.settle(state, 0, true);
    mix.voice = state === 'speaking' ? 0.85 : 0.6;
    return mix;
  };

  // A self-running view (the home card or the mirror's large preview).
  function createView(host, glsl, { state = cardState, className = '', maxDpr = 1.75, allowFallback = true } = {}) {
    let canvas = null, renderer = null, frame = 0, last = 0, elapsed = 6.5, visible = true;
    let width = 0, height = 0, dpr = 1, disposed = false, log = '';
    const mix = createMix();
    const install = (source) => {
      renderer?.dispose();
      canvas?.remove();
      canvas = document.createElement('canvas');
      canvas.className = className;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); if (frame) cancelAnimationFrame(frame); frame = 0; if (allowFallback) install(null); });
      host.append(canvas);
      renderer = null;
      if (source) {
        const made = glPortrait(canvas, source, false);
        if (made.ok) renderer = made; else { log = made.log; canvas.remove(); canvas = document.createElement('canvas'); canvas.className = className; canvas.setAttribute('aria-hidden', 'true'); host.append(canvas); }
      }
      if (!renderer && allowFallback) renderer = dotSphere(canvas);
      width = 0;
      ro?.disconnect(); ro?.observe(canvas);
      resize();
      return Boolean(renderer && renderer.name === 'portrait');
    };
    const canRun = () => !disposed && visible && !document.hidden && width > 0 && height > 0 && renderer;
    const draw = () => { if (canRun()) renderer.draw(elapsed, mix, canvas.width, canvas.height, lightTheme(), dpr); };
    function tick(now) {
      frame = 0;
      if (!canRun() || motionOff() || renderer.lost()) return;
      const interval = state() === 'idle' && mix.idle > 0.97 ? 32 : 15;
      if (!last || now - last >= interval) {
        const dt = last ? Math.min(now - last, 80) / 1000 : 0;
        elapsed += dt; last = now;
        mix.settle(state(), dt, false);
        draw();
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      last = 0;
      if (!canRun()) return;
      if (motionOff()) { mix.settle(state(), 0, true); draw(); return; }
      draw();
      frame = requestAnimationFrame(tick);
    }
    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nextDpr = Math.min(window.devicePixelRatio || 1, renderer?.name === 'portrait' ? maxDpr : 2);
      if (rect.width === width && rect.height === height && dpr === nextDpr) return;
      width = rect.width; height = rect.height; dpr = nextDpr;
      if (width && height) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
      sync();
    }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting ?? true; sync(); }) : null;
    io?.observe(host);
    const ok = install(glsl);
    return {
      ok, log,
      get renderer() { return renderer?.name || 'none'; },
      swap(source) { const done = install(source); return { ok: done, log }; },
      sync, resize,
      dispose() { disposed = true; if (frame) cancelAnimationFrame(frame); renderer?.dispose(); ro?.disconnect(); io?.disconnect(); canvas?.remove(); }
    };
  }

  // The mirror: one picture of every state on both themes for Hafize to look at,
  // plus plain measurements of each frame (how much of the card the figure fills,
  // how far it reaches, how well it stands out, how different the states are).
  async function sheet(glsl, { time = 7.2 } = {}) {
    const tileW = 276, tileH = 225, pad = 6;
    const out = document.createElement('canvas');
    out.width = tileW * 4 + pad * 5; out.height = tileH * 2 + pad * 3;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    const gl = document.createElement('canvas');
    gl.width = tileW; gl.height = tileH;
    const renderer = glPortrait(gl, glsl, true);
    if (!renderer.ok) return { ok: false, log: renderer.log };
    const names = { idle: 'Boşta', listening: 'Dinliyor', thinking: 'Düşünüyor', speaking: 'Konuşuyor' };
    const BG = { dark: [31, 31, 34], light: [247, 243, 238] };
    const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const tiles = [];
    const samples = {};
    ctx.fillStyle = '#2b2b30'; ctx.fillRect(0, 0, out.width, out.height);
    [false, true].forEach((light, row) => {
      const theme = light ? 'light' : 'dark';
      STATES.forEach((state, col) => {
        const x = pad + col * (tileW + pad), y = pad + row * (tileH + pad);
        ctx.fillStyle = light ? '#f7f3ee' : '#1f1f22';
        ctx.fillRect(x, y, tileW, tileH);
        const mix = settled(state);
        mix.flow = 3.2 + time * (0.42 + 0.9 * mix.energy + 0.9 * mix.thinking);
        renderer.draw(time, mix, tileW, tileH, light, 1.5);
        ctx.drawImage(gl, x, y);
        const data = ctx.getImageData(x, y, tileW, tileH).data;
        const bg = BG[theme], bgL = luma(bg[0], bg[1], bg[2]);
        let covered = 0, total = 0, contrast = 0, minX = tileW, maxX = -1, minY = tileH, maxY = -1;
        const sample = [];
        for (let py = 0; py < tileH; py += 2) for (let px = 0; px < tileW; px += 2) {
          const i = (py * tileW + px) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          total += 1;
          sample.push(r, g, b);
          if (Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2])) > 16) {
            covered += 1; contrast += Math.abs(luma(r, g, b) - bgL);
            if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
          }
        }
        samples[theme + state] = sample;
        tiles.push({ state, theme, coverage: covered / total, width: maxX < 0 ? 0 : (maxX - minX + 2) / tileW, height: maxY < 0 ? 0 : (maxY - minY + 2) / tileH, contrast: covered ? Math.min(1, contrast / covered) : 0 });
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.fillStyle = light ? 'rgba(40,40,44,.6)' : 'rgba(255,255,255,.6)';
        ctx.fillText(names[state], x + 8, y + 18);
      });
    });
    renderer.dispose();
    const base = samples.darkidle;
    let diff = 0, count = 0;
    for (const state of ['listening', 'thinking', 'speaking']) {
      const other = samples['dark' + state];
      for (let i = 0; i < base.length; i += 1) { diff += Math.abs(base[i] - other[i]) / 255; count += 1; }
    }
    const metrics = { tiles: tiles.map((t) => ({ ...t, coverage: Math.round(t.coverage * 1000) / 1000, width: Math.min(1, Math.round(t.width * 1000) / 1000), height: Math.min(1, Math.round(t.height * 1000) / 1000), contrast: Math.round(t.contrast * 1000) / 1000 })), distinct: Math.round((count ? diff / count : 0) * 1000) / 1000 };
    // Hosted vision endpoints reject large inline images.
    let dataUrl = out.toDataURL('image/jpeg', 0.86);
    if (dataUrl.length > 220000) dataUrl = out.toDataURL('image/jpeg', 0.7);
    return { ok: true, dataUrl, width: out.width, height: out.height, metrics };
  }

  function test(glsl) {
    const scratch = document.createElement('canvas');
    scratch.width = 16; scratch.height = 16;
    const made = glPortrait(scratch, glsl, false);
    if (made.ok) made.dispose();
    return { ok: Boolean(made.ok), log: made.ok ? '' : made.log };
  }

  // The home card.
  orb.dataset.luminousCore = 'ready';
  let published = null;
  let home = null;
  const startHome = (source) => {
    home = createView(orb, source, { className: 'hz-luminous-core' });
    orb.dataset.luminousRenderer = home.renderer;
    if (published && home.renderer === 'portrait') orb.dataset.portrait = published.id; else delete orb.dataset.portrait;
  };
  const observer = new MutationObserver(() => home?.sync());
  observer.observe(card, { attributes: true, attributeFilter: ['class'] });
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-reduced-motion', 'data-voice-mode'] });
  reduced.addEventListener?.('change', () => home?.sync());
  document.addEventListener('visibilitychange', () => home?.sync());
  window.addEventListener('resize', () => home?.resize(), { passive: true });
  window.addEventListener('pageshow', () => { home?.resize(); home?.sync(); });

  const ready = fetch('/hafize-self-portrait.json', { cache: 'no-cache', credentials: 'same-origin' })
    .then((response) => response.ok ? response.json() : null)
    .catch(() => null)
    .then((doc) => {
      if (doc && doc.schema === 'hafize.self-portrait.v1' && typeof doc.glsl === 'string' && typeof doc.id === 'string') published = Object.freeze(doc);
      startHome(published ? published.glsl : null);
      if (published && home.renderer !== 'portrait') console.warn('hafize.portrait compile failed; dot sphere shown');
      return published;
    });

  window.HafizePortrait = Object.freeze({
    version: 1,
    ready,
    current: () => published ? { id: published.id, name: published.name, essence: published.essence, renderer: home?.renderer || 'none' } : null,
    test,
    sheet,
    mount: (host, glsl, options = {}) => {
      let fixed = typeof options.state === 'string' && STATES.includes(options.state) ? options.state : null;
      const started = performance.now();
      const view = createView(host, glsl, { className: options.className || '', maxDpr: 2, allowFallback: false, state: () => fixed || STATES[Math.floor((performance.now() - started) / 3600) % 4] });
      return { ok: view.ok, log: view.log, setState(next) { fixed = STATES.includes(next) ? next : null; }, state: () => fixed || STATES[Math.floor((performance.now() - started) / 3600) % 4], dispose: () => view.dispose() };
    },
    preview: (glsl) => { if (!home) return { ok: false, log: 'NOT_READY' }; const result = home.swap(glsl); orb.dataset.luminousRenderer = home.renderer; orb.dataset.preview = 'true'; return result; },
    reset: () => { if (!home) return; home.swap(published ? published.glsl : null); orb.dataset.luminousRenderer = home.renderer; delete orb.dataset.preview; }
  });
})();
