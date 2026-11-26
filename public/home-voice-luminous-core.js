/* Compact home voice visualization only. No audio capture, dependencies or network. */
(() => {
  const orb = document.querySelector('.main .utility-rail .voice-card .voice-orb');
  if (!orb || orb.querySelector('canvas.hz-luminous-core')) return;
  const card = orb.closest('.voice-card');
  const canvas = document.createElement('canvas');
  canvas.className = 'hz-luminous-core';
  canvas.setAttribute('aria-hidden', 'true');
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: true }); } catch { return; }
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const points = Array.from({ length: 920 }, (_, i) => {
    const y = 1 - 2 * (i + .5) / 920;
    const a = i * GOLDEN;
    const r = Math.sqrt(1 - y*y);
    return { x: r*Math.cos(a), y, z: r*Math.sin(a), phase: i*2.399963, i };
  });
  let frame = 0, last = 0, elapsed = 0, energy = 0, visible = true;
  let width = 0, height = 0, dpr = 1;
  const motionOff = () => reduced.matches || root.dataset.reducedMotion === 'true';
  const state = () => card.classList.contains('speaking') ? 'speaking'
    : card.classList.contains('listening') ? 'listening'
    : card.classList.contains('thinking') ? 'thinking' : 'idle';
  const canRun = () => visible && !document.hidden && width > 0 && height > 0;
  function draw(t) {
    if (!width || !height) return;
    const mode = state();
    const target = mode === 'speaking' ? 1 : mode === 'listening' ? .72 : mode === 'thinking' ? .43 : .12;
    energy += (target-energy)*.09;
    const cx = width/2, cy = height/2, unit = Math.min(width,height);
    const dark = root.dataset.theme !== 'light';
    const spin = t*.24;
    const tilt = .39 + .12*Math.sin(t*.48);
    const radius = unit*.343*(1 + .018*Math.sin(t*1.2) + energy*.028*Math.sin(t*4.1));
    ctx.clearRect(0,0,width,height);
    const glow = ctx.createRadialGradient(cx,cy,0,cx,cy,unit*.49);
    glow.addColorStop(0, dark ? 'rgba(255,133,74,.16)' : 'rgba(190,75,28,.10)');
    glow.addColorStop(.48, dark ? 'rgba(239,105,49,.095)' : 'rgba(201,90,45,.07)');
    glow.addColorStop(1,'rgba(225,108,54,0)');
    ctx.fillStyle = glow; ctx.fillRect(0,0,width,height);
    const projected = points.map(p => {
      const wave = Math.sin(p.y*10 + p.phase*.12 - t*(1.1+energy*1.4));
      const displacement = 1 + (.018+energy*.025)*wave;
      const x = p.x*Math.cos(spin) + p.z*Math.sin(spin);
      const z0 = p.z*Math.cos(spin) - p.x*Math.sin(spin);
      const y = p.y*Math.cos(tilt) - z0*Math.sin(tilt);
      const z = p.y*Math.sin(tilt) + z0*Math.cos(tilt);
      const perspective = 1/(1-z*.16);
      return { x:cx+x*radius*perspective*displacement, y:cy+y*radius*perspective*displacement,
        z, light:Math.max(0, -.45*x-.55*y+.68*z), wave, i:p.i };
    }).sort((a,b)=>a.z-b.z);
    // A soft, narrow travelling band makes the sphere feel like illuminated matter.
    for (const p of projected) {
      const depth = (p.z+1)/2;
      const band = Math.pow(Math.max(0, Math.cos((p.y-cy)/radius*7 + (p.x-cx)/radius*3 - t*(1.3+energy))), 9);
      const luminous = Math.min(1, .12 + p.light*.75 + band*.37);
      const size = unit*(.003 + .0046*depth + .0016*band);
      const alpha = (.13+.72*depth)*(.66+.34*luminous);
      const red = dark ? 255 : Math.round(174+55*luminous);
      const green = Math.round((dark?112:57)+(dark?118:89)*luminous);
      const blue = Math.round((dark?61:27)+(dark?141:84)*luminous);
      ctx.fillStyle = 'rgba('+red+','+green+','+blue+','+alpha.toFixed(3)+')';
      ctx.beginPath(); ctx.arc(p.x,p.y,size,0,Math.PI*2); ctx.fill();
      if (p.z>.38 && luminous>.84 && p.i%7===0) {
        ctx.fillStyle = dark?'rgba(255,213,163,.09)':'rgba(204,85,37,.09)';
        ctx.beginPath();ctx.arc(p.x,p.y,size*2.8,0,Math.PI*2);ctx.fill();
      }
    }
    // Sparse inner sparks, not an opaque core or glass shell.
    for(let i=0;i<22;i++){
      const a=i*GOLDEN+t*.16, r=radius*.42*Math.sqrt((i+.5)/22);
      const pulse=.22+.38*Math.pow(.5+.5*Math.sin(t*1.6+i*1.7),3);
      ctx.fillStyle=dark?'rgba(255,191,124,'+pulse+')':'rgba(180,74,32,'+pulse+')';
      ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.82,unit*.004,0,Math.PI*2);ctx.fill();
    }
  }
  function tick(now) {
    frame=0;
    if (!canRun() || motionOff()) return;
    if (!last || now-last>=32) {
      elapsed += last ? Math.min(now-last,80)/1000 : 0;
      last=now; draw(elapsed);
    }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    if(frame){cancelAnimationFrame(frame);frame=0;}
    last=0;
    if(!canRun())return;
    if(motionOff()){energy=state()==='idle'?.12:.7;draw(elapsed);return;}
    draw(elapsed);frame=requestAnimationFrame(tick);
  }
  function resize() {
    const rect=canvas.getBoundingClientRect();
    const nextDpr=Math.min(window.devicePixelRatio||1,2);
    if(rect.width===width&&rect.height===height&&dpr===nextDpr)return;
    width=rect.width;height=rect.height;dpr=nextDpr;
    if(width&&height){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
    sync();
  }
  orb.append(canvas);
  orb.dataset.luminousCore='ready';
  const ro=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  ro?.observe(canvas);
  const io=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;sync();}):null;
  io?.observe(orb);
  const observer=new MutationObserver(()=>{if(motionOff()||!frame)sync();});
  observer.observe(card,{attributes:true,attributeFilter:['class']});
  observer.observe(root,{attributes:true,attributeFilter:['data-theme','data-reduced-motion','data-voice-mode']});
  reduced.addEventListener?.('change',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('pagehide',()=>{if(frame)cancelAnimationFrame(frame);frame=0;last=0;});
  window.addEventListener('pageshow',()=>{resize();sync();});
  resize();
})();
