/* Hafize Core: the compact home voice orb (utility rail only).
 * A luminous liquid-glass sphere: three silky aurora ribbons (gold, coral,
 * rose) drift through a refracting interior around a breathing heart, under an
 * iridescent fresnel rim, a soft specular and a glint. A hairline orbit carries
 * a comet of light, with a few sparks; a halo and a light pool sit around it.
 * It answers the voice card's state classes: idle breathes slowly, listening
 * sends fine rings outward, thinking speeds the flow and adds a second comet,
 * speaking draws a living voice waveform around the glass.
 * WebGL 1 with a Canvas 2D dot-sphere fallback. Reduced motion draws one still
 * frame; hidden or off-screen it does not render. The full-screen voice orb
 * (voice-orb.ts / voice-visual.ts) is not touched. No audio capture,
 * dependencies or network.
 */
(() => {
  const orb = document.querySelector('.main .utility-rail .voice-card .voice-orb');
  if (!orb || orb.querySelector('canvas.hz-luminous-core')) return;
  const card = orb.closest('.voice-card');
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'hz-luminous-core';
  canvas.setAttribute('aria-hidden', 'true');

  const STATES = ['idle', 'listening', 'thinking', 'speaking'];
  const motionOff = () => reduced.matches || root.dataset.reducedMotion === 'true';
  const lightTheme = () => root.dataset.theme === 'light';
  const state = () => card.classList.contains('speaking') ? 'speaking'
    : card.classList.contains('listening') ? 'listening'
    : card.classList.contains('thinking') ? 'thinking' : 'idle';

  const VERTEX = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';
  const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform float uFlow;
uniform float uEnergy;
uniform float uListen;
uniform float uThink;
uniform float uSpeak;
uniform float uLight;

float hash1(float n){return fract(sin(n*127.1)*43758.5453);}
mat2 rot2(float a){float c=cos(a);float s=sin(a);return mat2(c,-s,s,c);}

// Three silky aurora ribbons drifting through the glass.
vec3 aurora(vec2 q,float f,float energy){
  vec3 acc=vec3(0.0);
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 r=rot2(fi*1.05+0.35*sin(f*0.21+fi))*q;
    float y=0.34*sin(r.x*1.55+f*0.62+fi*2.09)+0.16*sin(r.x*3.2-f*0.94+fi*1.3)+(fi-1.0)*0.22;
    float w=0.13+0.05*sin(f*0.5+fi*1.7+r.x*2.3)+0.05*energy;
    float d=(r.y-y)/w;
    float band=exp(-d*d);
    float thread=exp(-d*d*14.0);
    vec3 c=fi<0.5?vec3(1.0,0.78,0.42):(fi<1.5?vec3(1.0,0.42,0.24):vec3(0.96,0.30,0.46));
    acc+=c*(band*0.62+thread*0.55);
  }
  return acc;
}

void main(){
  float scale=0.5*min(uRes.x,uRes.y);
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/scale;
  float t=uTime;
  float f=uFlow;
  float px=1.0/scale;
  float r=length(uv);
  float ang=atan(uv.y,uv.x);
  float E=uEnergy;
  float R=0.58*(1.0+0.012*sin(t*1.1)+0.014*E*sin(t*2.9));
  float light=uLight;
  float glowScale=mix(1.0,0.62,light);
  vec3 col=vec3(0.0);

  // Halo and the light pool the core casts beneath itself.
  float outside=max(r-R,0.0);
  vec3 haloCol=mix(vec3(1.0,0.42,0.20),vec3(1.0,0.36,0.30),0.5+0.5*sin(ang+f*0.3));
  col+=haloCol*(exp(-outside*7.5)*(0.26+0.34*E)+exp(-outside*22.0)*0.22)*glowScale;
  vec2 pool=(uv-vec2(0.0,-R*1.30))/vec2(R*0.90,R*0.13);
  col+=vec3(1.0,0.45,0.22)*exp(-dot(pool,pool)*1.6)*(0.14+0.16*E)*glowScale;

  // Listening: fine rings leave the glass and fade out.
  if(uListen>0.001){
    for(int k=0;k<3;k++){
      float phase=fract(t*0.42+float(k)/3.0);
      float ringR=R*(1.04+phase*0.62);
      float ring=smoothstep(px*1.6,0.0,abs(r-ringR))*(1.0-phase)*(1.0-phase);
      col+=mix(vec3(1.0,0.68,0.46),vec3(0.88,0.38,0.18),light)*ring*0.85*uListen;
    }
  }
  // Speaking: a luminous voice waveform around the glass.
  if(uSpeak>0.001){
    float a=0.045*sin(6.0*ang+t*7.3)+0.030*sin(11.0*ang-t*9.1)+0.020*sin(17.0*ang+t*12.7);
    float vr=R*(1.12+a*uSpeak);
    float lineW=abs(r-vr);
    col+=mix(vec3(1.0,0.74,0.50),vec3(0.90,0.40,0.18),light)*(smoothstep(px*1.8,0.0,lineW)+exp(-lineW*40.0)*0.35)*uSpeak;
  }

  // Orbit: one hairline ellipse, a comet with a fading tail, a few sparks.
  vec2 q=rot2(0.30)*uv;
  vec2 axes=vec2(1.00,0.24);
  vec2 e=q/axes;
  float le=max(length(e),1e-4);
  float grad=length(e/(le*axes));
  float dist=abs(le-1.0)/max(grad,1e-4);
  float turn=atan(e.y,e.x)/6.2831853+0.5;
  float front=step(e.y,0.0);
  float hidden=(1.0-front)*(1.0-smoothstep(R-px,R+px,r));
  float lineMask=smoothstep(px*1.15,0.0,dist);
  float comet=fract(f*0.075);
  float gap=fract(comet-turn);
  float tail=exp(-gap*6.5);
  float comet2=fract(comet+0.5);
  float gap2=fract(comet2-turn);
  float tail2=exp(-gap2*6.5)*uThink;
  float headGap=min(min(gap,1.0-gap),mix(1.0,min(gap2,1.0-gap2),step(0.01,uThink)));
  float head=exp(-pow(headGap*6.2831853*0.55/(px*3.0),2.0))*exp(-dist*dist/(px*px*4.0));
  float sparkIdx=floor(turn*44.0);
  float spark=step(0.72,hash1(sparkIdx))*(0.5+0.5*sin(t*(1.4+2.0*hash1(sparkIdx+3.0))+sparkIdx));
  float sparkDot=smoothstep(px*1.7,0.0,length(vec2((fract(turn*44.0)-0.5)/44.0*6.2831853*0.6,dist)));
  vec3 orbitCol=mix(vec3(1.0,0.80,0.60),vec3(0.80,0.30,0.12),light);
  float orbitLight=lineMask*(0.16+1.05*(tail+tail2))*mix(0.55,1.0,front)+head*1.4+sparkDot*spark*0.7+exp(-dist*45.0)*(tail+tail2)*0.18;
  vec3 orbit=orbitCol*orbitLight*(1.0-hidden);

  // The glass core.
  vec3 sphere=vec3(0.0);
  float cover=0.0;
  vec2 p=uv/R;
  float d2=dot(p,p);
  if(d2<1.0){
    float z=sqrt(1.0-d2);
    vec3 n=vec3(p,z);
    float edge=sqrt(d2);
    // Refraction-like bulge so the interior reads as volume, slowly rotating.
    vec2 lens=rot2(f*0.06)*(p*(1.0+0.42*(1.0-z)));
    float heartbeat=0.72+0.28*sin(t*(1.4+2.4*E));
    vec3 deep=vec3(0.36,0.05,0.10);
    vec3 body=vec3(0.92,0.28,0.13);
    float lit=smoothstep(-0.9,0.8,dot(n,normalize(vec3(-0.35,0.55,0.75))));
    vec3 base=mix(deep,body,lit*0.85+0.15*(1.0-d2));
    vec3 heart=vec3(1.0,0.62,0.30)*exp(-d2*2.4)*(0.42+0.62*E)*heartbeat;
    vec3 ribbons=aurora(lens*1.05,f,E)*(0.60+0.75*E)*(1.0-0.45*smoothstep(0.55,1.0,edge));
    float fres=pow(1.0-z,2.4);
    vec3 film=0.5+0.5*cos(6.2831853*(vec3(0.0,0.10,0.24)+fres*0.7+f*0.02));
    vec3 rim=mix(vec3(1.0,0.66,0.46),film,0.28)*fres*(1.0+0.5*E);
    vec2 hp=rot2(-0.62)*(n.xy-vec2(-0.36,0.44));
    float spec=exp(-dot(hp/vec2(0.30,0.13),hp/vec2(0.30,0.13)))*0.42;
    float glint=exp(-dot(n.xy-vec2(-0.30,0.47),n.xy-vec2(-0.30,0.47))*900.0)*0.9;
    float caustic=smoothstep(0.55,0.97,edge)*smoothstep(-0.10,-0.85,p.y)*(0.38+0.30*E);
    sphere=base+heart+ribbons+rim+vec3(1.0,0.95,0.90)*(spec+glint)+vec3(1.0,0.60,0.32)*caustic;
    cover=smoothstep(1.0,1.0-px*1.6/R,edge);
  }
  col=col*(1.0-cover)+sphere*cover+orbit;
  col=1.0-exp(-col*1.25);
  float alpha=clamp(max(cover,max(col.r,max(col.g,col.b))),0.0,1.0);
  gl_FragColor=vec4(col,alpha);
}`;

  function startWebGL() {
    let gl;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    } catch { gl = null; }
    if (!gl) return null;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = Object.fromEntries(['uRes', 'uTime', 'uFlow', 'uEnergy', 'uListen', 'uThink', 'uSpeak', 'uLight']
      .map((name) => [name, gl.getUniformLocation(program, name)]));
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    return {
      name: 'webgl',
      resize(width, height) { gl.viewport(0, 0, width, height); },
      draw(t, mix, width, height) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uniform.uRes, width, height);
        gl.uniform1f(uniform.uTime, t);
        gl.uniform1f(uniform.uFlow, mix.flow);
        gl.uniform1f(uniform.uEnergy, mix.energy);
        gl.uniform1f(uniform.uListen, mix.listening);
        gl.uniform1f(uniform.uThink, mix.thinking);
        gl.uniform1f(uniform.uSpeak, mix.speaking * mix.voice);
        gl.uniform1f(uniform.uLight, lightTheme() ? 1 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      lost: () => gl.isContextLost()
    };
  }

  // Canvas 2D fallback: the previous lit dot sphere.
  function startCanvas() {
    let ctx;
    try { ctx = canvas.getContext('2d', { alpha: true }); } catch { ctx = null; }
    if (!ctx) return null;
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const points = Array.from({ length: 920 }, (_, i) => {
      const y = 1 - 2 * (i + 0.5) / 920;
      const a = i * GOLDEN;
      const r = Math.sqrt(1 - y * y);
      return { x: r * Math.cos(a), y, z: r * Math.sin(a), phase: i * 2.399963, i };
    });
    let dpr = 1;
    return {
      name: 'canvas',
      resize(width, height, ratio) { dpr = ratio; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); },
      draw(t, mix, deviceWidth, deviceHeight) {
        const width = deviceWidth / dpr;
        const height = deviceHeight / dpr;
        const energy = mix.energy;
        const cx = width / 2, cy = height / 2, unit = Math.min(width, height);
        const dark = !lightTheme();
        const spin = t * 0.24;
        const tilt = 0.39 + 0.12 * Math.sin(t * 0.48);
        const radius = unit * 0.343 * (1 + 0.018 * Math.sin(t * 1.2) + energy * 0.028 * Math.sin(t * 4.1));
        ctx.clearRect(0, 0, width, height);
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.49);
        glow.addColorStop(0, dark ? 'rgba(255,133,74,.16)' : 'rgba(190,75,28,.10)');
        glow.addColorStop(0.48, dark ? 'rgba(239,105,49,.095)' : 'rgba(201,90,45,.07)');
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
          const red = dark ? 255 : Math.round(174 + 55 * luminous);
          const green = Math.round((dark ? 112 : 57) + (dark ? 118 : 89) * luminous);
          const blue = Math.round((dark ? 61 : 27) + (dark ? 141 : 84) * luminous);
          ctx.fillStyle = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      lost: () => false
    };
  }

  let renderer = startWebGL() || startCanvas();
  if (!renderer) return;

  // Smoothly blended state weights; the speaking "voice" is a syllable-like envelope.
  const mix = { flow: 3.2, energy: 0.14, idle: 1, listening: 0, thinking: 0, speaking: 0, voice: 0.6 };
  const ENERGY = { idle: 0.14, listening: 0.62, thinking: 0.48, speaking: 0.9 };
  let voiceTarget = 0.6, nextSyllable = 0;
  let frame = 0, last = 0, elapsed = 6.5, visible = true;
  let width = 0, height = 0, dpr = 1;
  const canRun = () => visible && !document.hidden && width > 0 && height > 0;

  function settle(dt, instant) {
    const current = state();
    const k = instant ? 1 : 1 - Math.exp(-dt * 4.2);
    for (const name of STATES) mix[name] += ((current === name ? 1 : 0) - mix[name]) * k;
    mix.energy += (ENERGY[current] - mix.energy) * k;
    if (current === 'speaking') {
      if (elapsed >= nextSyllable) {
        voiceTarget = 0.35 + Math.random() * 0.65;
        nextSyllable = elapsed + 0.09 + Math.random() * 0.12;
      }
    } else {
      voiceTarget = 0.6;
    }
    mix.voice += (voiceTarget - mix.voice) * (instant ? 1 : 1 - Math.exp(-dt * 14));
    // Flow clock: the interior drifts faster with energy and while thinking.
    mix.flow += dt * (0.42 + 0.9 * mix.energy + 0.9 * mix.thinking);
  }

  function draw() {
    if (!width || !height) return;
    renderer.draw(elapsed, mix, Math.round(width * dpr), Math.round(height * dpr));
  }

  function tick(now) {
    frame = 0;
    if (!canRun() || motionOff()) return;
    if (renderer.lost()) return;
    // 60 fps while active, 30 fps at rest.
    const interval = state() === 'idle' && mix.idle > 0.97 ? 32 : 15;
    if (!last || now - last >= interval) {
      const dt = last ? Math.min(now - last, 80) / 1000 : 0;
      elapsed += dt;
      last = now;
      settle(dt, false);
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    last = 0;
    if (!canRun()) return;
    if (motionOff()) { settle(0, true); draw(); return; }
    draw();
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nextDpr = Math.min(window.devicePixelRatio || 1, renderer.name === 'webgl' ? 1.75 : 2);
    if (rect.width === width && rect.height === height && dpr === nextDpr) return;
    width = rect.width;
    height = rect.height;
    dpr = nextDpr;
    if (width && height) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      renderer.resize(canvas.width, canvas.height, dpr);
    }
    sync();
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    renderer = startWebGL() || renderer;
    width = 0;
    resize();
  });

  orb.append(canvas);
  orb.dataset.luminousCore = 'ready';
  orb.dataset.luminousRenderer = renderer.name;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting ?? true; sync(); })
    : null;
  io?.observe(orb);
  const observer = new MutationObserver(() => { if (motionOff() || !frame) sync(); });
  observer.observe(card, { attributes: true, attributeFilter: ['class'] });
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-reduced-motion', 'data-voice-mode'] });
  reduced.addEventListener?.('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pagehide', () => { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; });
  window.addEventListener('pageshow', () => { resize(); sync(); });
  resize();
})();
