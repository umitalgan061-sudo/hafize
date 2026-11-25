/* Independent screen-edge renderer. No SVG timeline or CSS custom-property animation. */
(() => {
  'use strict';
  const root = document.documentElement;
  const frame = document.querySelector('.hz-frame');
  if (!frame || root.dataset.hzPerimeter === 'running') return;
  const canvas = frame.querySelector('#hz-perimeter-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const messages = document.getElementById('messages');
  let width=0,height=0,scale=1,progress=.12,last=0,painted=0,raf=0;
  const busy = () => root.classList.contains('hafize-working') ||
    root.dataset.hafizeGenerating === 'true' || messages?.getAttribute('aria-busy') === 'true';
  const allowed = () => !document.hidden && !reduced.matches && !forced.matches && root.dataset.reducedMotion !== 'true';
  function size() {
    const box=canvas.getBoundingClientRect();
    width=box.width;height=box.height;scale=Math.min(devicePixelRatio||1,1.5);
    const w=Math.round(width*scale),h=Math.round(height*scale);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.setTransform(scale,0,0,scale,0,0);
  }
  function draw(active) {
    if(width<24||height<24)return;
    ctx.clearRect(0,0,width,height);
    const inset=width<=680?5:4;
    const w=width-2*inset,h=height-2*inset;
    const radius=typeof ctx.roundRect==='function'?Math.min(width<=680?12:7,w/2,h/2):0;
    const length=2*(w+h)-8*radius+2*Math.PI*radius;
    const beam=Math.min(active?240:150,Math.max(85,length*(active?.085:.065)));
    ctx.beginPath();
    if(radius)ctx.roundRect(inset,inset,w,h,radius);else ctx.rect(inset,inset,w,h);
    ctx.lineCap='round';
    const colors=active?[[1,7,'rgba(255,117,46,.12)'],[.92,3,'rgba(237,115,58,.42)'],[.68,3,'rgba(255,139,71,.80)'],[.43,3,'rgba(255,175,105,.97)'],[.19,2,'#ffdab1']]:
      [[1,5,'rgba(222,126,83,.09)'],[.92,1.5,'rgba(222,126,83,.25)'],[.68,1.8,'rgba(232,143,96,.55)'],[.43,2,'rgba(245,161,111,.80)'],[.19,1.5,'#ffc398']];
    for(const [fraction,weight,color] of colors){
      const dash=beam*fraction;
      ctx.setLineDash([dash,length-dash]);
      ctx.lineDashOffset=dash/2-progress*length;
      ctx.lineWidth=weight;ctx.strokeStyle=color;ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  function tick(now) {
    raf=0;
    if(!allowed()) {last=0;ctx.clearRect(0,0,width,height);return;}
    if(!last)last=now;
    const active=busy();
    progress=(progress+Math.min(now-last,100)/(active?5000:13000))%1;
    last=now;
    if(now-painted>=30){draw(active);painted=now;}
    raf=requestAnimationFrame(tick);
  }
  function sync() {
    if(!allowed()){
      if(raf)cancelAnimationFrame(raf);
      raf=0;last=0;ctx.clearRect(0,0,width,height);return;
    }
    size();draw(busy());
    if(!raf){last=0;raf=requestAnimationFrame(tick);}
  }
  size();
  if(width<=0||height<=0)return;
  root.dataset.hzPerimeter='running';
  sync();
  addEventListener('resize',sync,{passive:true});
  window.visualViewport?.addEventListener('resize',sync,{passive:true});
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener?.('change',sync);
  forced.addEventListener?.('change',sync);
  const observer=new MutationObserver(sync);
  observer.observe(root,{attributes:true,attributeFilter:['class','data-hafize-generating','data-reduced-motion']});
  if(messages)observer.observe(messages,{attributes:true,attributeFilter:['aria-busy']});
})();
