const fs = require('fs');
const fontB64 = fs.readFileSync('playfair.ttf').toString('base64');
const KEYED = '/Users/darrenfullerton/Claude/oneshetland-web/public/brand/logo-mark-keyed.png';

const W = 1080, H = 1920, FPS = 30, DURATION = 4.0;
const FRAMES = Math.round(FPS * DURATION);
const CREAM = '#F4EDDF';
const MB = 600, MARK_LEFT = (W - MB) / 2, MARK_TOP = 560;

const rings = [
  { rx:330, ry:410, rot:-12, c:'#0B5E86', w:22, op:0.95, delay:0.00, swing: 16 },
  { rx:300, ry:360, rot:-42, c:'#3E63B0', w:20, op:0.85, delay:0.08, swing:-22 },
  { rx:382, ry:332, rot: 18, c:'#19B3A6', w:20, op:0.85, delay:0.16, swing: 20 },
  { rx:262, ry:305, rot:  3, c:'#E6B24C', w:20, op:0.92, delay:0.24, swing:-18 },
  { rx:430, ry:292, rot:-24, c:'#F0936B', w:20, op:0.90, delay:0.32, swing: 24 },
  { rx:352, ry:418, rot: 14, c:'#A874C0', w:20, op:0.85, delay:0.40, swing:-20 },
];

const easeInOut = t => t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
const easeOut   = t => 1-Math.pow(1-t,3);
const clamp01   = t => Math.max(0, Math.min(1, t));

const DRAW_DUR=1.5, SETTLE=1.85, XF_START=1.75, XF_DUR=0.7, WORD_START=2.35, WORD_DUR=0.9;

function brushRing(r, t) {
  const p = easeInOut(clamp01((t - r.delay) / DRAW_DUR));
  const off = 1000 * (1 - p);
  const s = t < SETTLE ? Math.sin(Math.PI * (t / SETTLE)) : 0;
  const ang = r.rot + r.swing * s;
  const k = t < SETTLE ? (1 - t/SETTLE) : 0;
  const wx = Math.sin(t*0.9 + r.delay*6) * 4 * k;
  const wy = Math.cos(t*0.8 + r.delay*5) * 4 * k;
  const tf = `translate(${wx.toFixed(2)} ${wy.toFixed(2)}) rotate(${ang.toFixed(3)} 500 500)`;
  return `
   <ellipse cx="500" cy="500" rx="${r.rx}" ry="${r.ry}" pathLength="1000" transform="${tf}"
     stroke="${r.c}" stroke-width="${r.w}" stroke-opacity="${r.op}"
     stroke-dasharray="1000" stroke-dashoffset="${off.toFixed(1)}"/>
   <ellipse cx="497" cy="503" rx="${r.rx-3}" ry="${r.ry+2}" pathLength="1000" transform="${tf}"
     stroke="${r.c}" stroke-width="${(r.w*0.45).toFixed(1)}" stroke-opacity="${(r.op*0.5).toFixed(2)}"
     stroke-dasharray="1000" stroke-dashoffset="${off.toFixed(1)}"/>`;
}

function frameHTML(t) {
  const vec = rings.map(r => brushRing(r, t)).join('');
  const xf = easeInOut(clamp01((t - XF_START) / XF_DUR));
  const vOp = (1 - xf).toFixed(3), pOp = xf.toFixed(3);
  const wp = easeOut(clamp01((t - WORD_START) / WORD_DUR));
  const wy = ((1 - wp) * 26).toFixed(2), wop = wp.toFixed(3);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
   @font-face{font-family:'PF';src:url('data:font/ttf;base64,${fontB64}') format('truetype');font-weight:400 900;}
   html,body{margin:0;padding:0;background:transparent;}
   .stage{width:${W}px;height:${H}px;position:relative;overflow:hidden;}
   .mark{position:absolute;left:${MARK_LEFT}px;top:${MARK_TOP}px;width:${MB}px;height:${MB}px;}
   .mark svg, .mark img{position:absolute;inset:0;width:${MB}px;height:${MB}px;}
   .mark svg ellipse{fill:none;stroke-linecap:round;stroke-linejoin:round;}
   .wm{position:absolute;left:0;right:0;top:${MARK_TOP+MB-40}px;text-align:center;
       font-family:'PF',serif;font-weight:500;font-size:122px;color:${CREAM};letter-spacing:1px;
       opacity:${wop};transform:translateY(${wy}px);text-shadow:0 4px 24px rgba(0,0,0,0.35);}
  </style></head><body><div class="stage">
   <div class="mark">
     <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" style="opacity:${vOp}">${vec}</svg>
     <img src="file://${KEYED}" style="opacity:${pOp}"/>
   </div>
   <div class="wm">OneShetland</div>
  </div></body></html>`;
}

if (!fs.existsSync('wframes')) fs.mkdirSync('wframes');
for (let f = 0; f < FRAMES; f++) fs.writeFileSync(`wframes/f${String(f).padStart(4,'0')}.html`, frameHTML(f/FPS));
console.log('Wrote', FRAMES, 'overlay frames @', W+'x'+H);
