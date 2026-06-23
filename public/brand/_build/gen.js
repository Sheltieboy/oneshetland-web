const fs = require('fs');
const fontB64 = fs.readFileSync('playfair.ttf').toString('base64');
const KEYED = '/Users/darrenfullerton/Claude/oneshetland-web/public/brand/logo-mark-keyed.png';

const SIZE = 1080, FPS = 30, DURATION = 6.5;
const FRAMES = Math.round(FPS * DURATION);
const CREAM = '#F4EDDF', NAVY = '#032F4C';
const MB = 600;            // mark box px
const MARK_TOP = 150;      // px from top

// rings matched to the painterly mark's colours/geometry (+ indigo loop)
const rings = [
  { rx:330, ry:410, rot:-12, c:'#032F4C', w:20, op:0.90, delay:0.00, swing: 16 },
  { rx:300, ry:360, rot:-42, c:'#2E4A8C', w:18, op:0.78, delay:0.10, swing:-22 }, // indigo
  { rx:382, ry:332, rot: 18, c:'#128B83', w:18, op:0.74, delay:0.20, swing: 20 },
  { rx:262, ry:305, rot:  3, c:'#D79A3B', w:18, op:0.86, delay:0.30, swing:-18 },
  { rx:430, ry:292, rot:-24, c:'#E7825C', w:18, op:0.80, delay:0.40, swing: 24 },
  { rx:352, ry:418, rot: 14, c:'#8F5AA8', w:18, op:0.74, delay:0.50, swing:-20 },
];

const easeInOut = t => t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
const easeOut   = t => 1-Math.pow(1-t,3);
const clamp01   = t => Math.max(0, Math.min(1, t));

const DRAW_DUR = 1.7;
const SETTLE   = 2.6;     // rings return to base orientation by here
const XF_START = 2.7, XF_DUR = 0.9;   // crossfade vector -> real PNG
const WORD_START = 3.3, WORD_DUR = 1.1;

function brushRing(r, t) {
  const p = easeInOut(clamp01((t - r.delay) / DRAW_DUR));
  const off = 1000 * (1 - p);
  // swing out then back to base by SETTLE
  const s = t < SETTLE ? Math.sin(Math.PI * (t / SETTLE)) : 0;
  const ang = r.rot + r.swing * s;
  const wx = Math.sin(t*0.9 + r.delay*6) * 4 * (t < SETTLE ? (1 - t/SETTLE) : 0);
  const wy = Math.cos(t*0.8 + r.delay*5) * 4 * (t < SETTLE ? (1 - t/SETTLE) : 0);
  const tf = `translate(${wx.toFixed(2)} ${wy.toFixed(2)}) rotate(${ang.toFixed(3)} 500 500)`;
  // brushy: thick core + 2 satellite strokes + dry-brush dash overlay, all draw-on
  return `
   <ellipse cx="500" cy="500" rx="${r.rx}" ry="${r.ry}" pathLength="1000" transform="${tf}"
     stroke="${r.c}" stroke-width="${r.w}" stroke-opacity="${r.op}"
     stroke-dasharray="1000" stroke-dashoffset="${off.toFixed(1)}"/>
   <ellipse cx="497" cy="503" rx="${r.rx-3}" ry="${r.ry+2}" pathLength="1000" transform="${tf}"
     stroke="${r.c}" stroke-width="${(r.w*0.5).toFixed(1)}" stroke-opacity="${(r.op*0.5).toFixed(2)}"
     stroke-dasharray="1000" stroke-dashoffset="${off.toFixed(1)}"/>
   <ellipse cx="503" cy="498" rx="${r.rx+2}" ry="${r.ry-3}" pathLength="1000" transform="${tf}"
     stroke="${r.c}" stroke-width="${(r.w*0.32).toFixed(1)}" stroke-opacity="${(r.op*0.55).toFixed(2)}"
     stroke-dasharray="14 7 4 9" stroke-dashoffset="${(off*0.3).toFixed(1)}"/>`;
}

function frameHTML(t) {
  const vec = rings.map(r => brushRing(r, t)).join('');
  // crossfade
  const xf = easeInOut(clamp01((t - XF_START) / XF_DUR));
  const vOp = (1 - xf).toFixed(3);
  const pOp = xf.toFixed(3);
  // wordmark
  const wp = easeOut(clamp01((t - WORD_START) / WORD_DUR));
  const wy = ((1 - wp) * 26).toFixed(2);
  const wop = wp.toFixed(3);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
   @font-face{font-family:'PF';src:url('data:font/ttf;base64,${fontB64}') format('truetype');font-weight:400 900;}
   html,body{margin:0;padding:0;}
   .stage{width:${SIZE}px;height:${SIZE}px;background:${CREAM};position:relative;overflow:hidden;}
   .mark{position:absolute;left:${(SIZE-MB)/2}px;top:${MARK_TOP}px;width:${MB}px;height:${MB}px;}
   .mark svg, .mark img{position:absolute;inset:0;width:${MB}px;height:${MB}px;}
   .mark svg ellipse{fill:none;stroke-linecap:round;stroke-linejoin:round;mix-blend-mode:multiply;}
   .png{mix-blend-mode:multiply;}
   .wm{position:absolute;left:0;right:0;top:${MARK_TOP+MB-26}px;text-align:center;
       font-family:'PF',serif;font-weight:500;font-size:130px;color:${NAVY};letter-spacing:1px;
       opacity:${wop};transform:translateY(${wy}px);}
  </style></head><body><div class="stage">
   <div class="mark">
     <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" style="opacity:${vOp}">${vec}</svg>
     <img class="png" src="file://${KEYED}" style="opacity:${pOp}"/>
   </div>
   <div class="wm">OneShetland</div>
  </div></body></html>`;
}

if (!fs.existsSync('frames')) fs.mkdirSync('frames');
for (let f = 0; f < FRAMES; f++) {
  fs.writeFileSync(`frames/f${String(f).padStart(4,'0')}.html`, frameHTML(f/FPS));
}
console.log('Wrote', FRAMES, 'frames @', FPS, 'fps,', DURATION, 's');
