// Fluid orb for the voice chat screen: a WebGL fragment shader that paints a softly lit sphere
// of warm, domain-warped bands (orange, peach, cream, a touch of pink) with a glow around it.
// `energy` (0..1) makes it swell and flow faster; `mood` shifts the palette per state.
// Without WebGL the caller keeps the CSS fallback orb visible.

export type OrbMood = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused';
export interface VoiceOrb { setEnergy(value: number): void; setMood(mood: OrbMood): void; start(): void; stop(): void; renderStill(): void; destroy(): void; }

const VERTEX = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

// Simplex noise (Ashima Arts / Ian McEwan, MIT) + fbm, then a lit sphere with flowing bands.
const FRAGMENT = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform float uEnergy;uniform float uMood;uniform float uRadius;
vec3 permute(vec3 x){return mod(((x*34.)+1.)*x,289.);}
float snoise(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);
vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;
m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*snoise(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y)*2.;
  float t=uTime;
  // A perfectly round orb that swells with energy; only a whisper of edge movement.
  float R=uRadius*(1.+.012*sin(t*1.1)+.07*uEnergy)+.004*snoise(vec2(atan(uv.y,uv.x)*1.2,t*.5))*(.3+uEnergy);
  float d=length(uv);
  // Palette: burnt orange, orange, peach, cream, rose. Thinking leans rose, listening brighter.
  vec3 burnt=vec3(.86,.33,.20),orange=vec3(.97,.55,.30),peach=vec3(1.,.74,.56),cream=vec3(1.,.95,.88),rose=vec3(.97,.58,.66);
  float rosiness=uMood==2.?.5:(uMood==1.?.16:.24);
  vec4 color=vec4(0.);
  if(d<R+.002){
    vec2 p=uv/R;
    float z=sqrt(max(0.,1.-dot(p,p)));
    // Low-frequency flow sampled on the curved surface: silky bands, never grainy.
    vec2 s=p*(1.-.28*z);
    vec2 q=vec2(fbm(s*.75+vec2(0.,t*.07)),fbm(s*.75+vec2(5.2,-t*.05)));
    float f=fbm(s*.95+1.4*q+vec2(t*.04,0.));
    float wave=s.y+.32*sin(s.x*2.1+t*.55+q.x*2.2)+.28*f;
    float body=.5+.5*sin(wave*3.-t*.35);
    float silk=pow(.5+.5*sin(wave*5.4-t*.6+.9*q.y),7.);
    float silk2=pow(.5+.5*sin(wave*4.1+1.7-t*.45),10.);
    vec3 col=mix(burnt,orange,smoothstep(-1.1,.5,p.y+.3*f));
    col=mix(col,peach,body*.72);
    col=mix(col,cream,silk*.85+silk2*.45);
    col=mix(col,rose,smoothstep(.15,1.1,(p.x+p.y)*.55+.35*q.y)*rosiness);
    // Soft studio light from the upper left, a gently darker rim lower right.
    float light=.8+.26*z+.12*dot(normalize(vec3(p,z+.001)),normalize(vec3(-.45,.55,.7)));
    col*=light;
    col+=cream*pow(max(0.,1.-length(p-vec2(-.3,.36))*1.5),3.)*.22;
    col=mix(col,col*vec3(.9,.78,.76),smoothstep(.65,1.05,length(p+vec2(-.25,.3))*.9)*.3);
    float edge=smoothstep(R,R-2.5/min(uRes.x,uRes.y)*2.,d);
    color=vec4(col,edge);
  }
  // Glow outside the edge, stronger with energy.
  // Faded out before the canvas edge, or the glow shows a square outline.
  float glow=exp(-max(0.,d-R)*(7.-3.*uEnergy))*(.22+.45*uEnergy)*(1.-smoothstep(.72,.98,d));
  vec3 glowCol=mix(orange,rose,rosiness*.6);
  float ga=glow*(1.-color.a);
  gl_FragColor=vec4(color.rgb*color.a+glowCol*ga,color.a+ga);
}`;

const MOOD_INDEX: Record<OrbMood, number> = { idle: 0, listening: 1, thinking: 2, speaking: 3, paused: 4 };
const MOOD_SPEED: Record<OrbMood, number> = { idle: 0.7, listening: 1.05, thinking: 2.1, speaking: 1.35, paused: 0.35 };

export function createVoiceOrb(canvas: HTMLCanvasElement, root: typeof globalThis = globalThis): VoiceOrb | null {
  const gl = (canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true })
    || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, 'uRes');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uEnergy = gl.getUniformLocation(program, 'uEnergy');
  const uMood = gl.getUniformLocation(program, 'uMood');
  const uRadius = gl.getUniformLocation(program, 'uRadius');
  gl.clearColor(0, 0, 0, 0);

  let energy = 0;
  let shown = 0;
  let mood: OrbMood = 'idle';
  let flow = Math.random() * 100;
  let last = 0;
  let frame: number | null = null;

  const resize = () => {
    const ratio = Math.min(2, root.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const draw = (time: number) => {
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0.016;
    last = time;
    shown += (energy - shown) * Math.min(1, dt * 9);
    flow += dt * (MOOD_SPEED[mood] + shown * 1.4);
    resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, flow);
    gl.uniform1f(uEnergy, shown);
    gl.uniform1f(uMood, MOOD_INDEX[mood]);
    gl.uniform1f(uRadius, 0.6);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const loop = (time: number) => { draw(time); frame = root.requestAnimationFrame(loop); };

  return {
    setEnergy(value) { energy = Math.max(0, Math.min(1, Number(value) || 0)); },
    setMood(next) { mood = next; },
    start() { if (frame == null) { last = 0; frame = root.requestAnimationFrame(loop); } },
    stop() { if (frame != null) root.cancelAnimationFrame(frame); frame = null; },
    renderStill() { shown = energy; draw(root.performance?.now?.() ?? 0); },
    destroy() {
      if (frame != null) root.cancelAnimationFrame(frame);
      frame = null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
