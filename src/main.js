// 확인용 화면. 엔진이 제대로 도는지 보기 위한 최소한의 그림이다.
// 최종 디자인은 이 파일의 draw()만 바꾸면 된다. 계산은 다른 파일에 있다.
//
// 주소 뒤에 붙이는 확인용 옵션
//   ?at=2026-06-06T09:00   이 시각부터 시작(한국 시각)
//   ?rate=3600             시간을 3600배 빠르게(1초 = 1시간). 절기가 바뀌는 모습 확인용
//   ?info=0                글자 숨기기

import { termAt } from './jeolgi.js';
import { sunAltitude, daylight } from './sun.js';
import { speedAt, warmthAt, virtualTime } from './season.js';
import { loadPan, poseAt } from './pan.js';

const params = new URLSearchParams(location.search);
const startReal = Date.now();
const startClock = params.get('at') ? Date.parse(params.get('at') + (/[zZ]|[+-]\d\d:?\d\d$/.test(params.get('at')) ? '' : '+09:00')) : startReal;
const rate = Number(params.get('rate')) || 1;
const showInfo = params.get('info') !== '0';
const clock = () => startClock + (Date.now() - startReal) * rate;

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const info = document.querySelector('#info');
if (!showInfo) info.hidden = true;

let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

const fmt = (ms) => {
  const d = new Date(ms + 9 * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

// 확인용 색: 따뜻함(-1..1)과 밝기(0..1)만으로 회색조 바탕을 정한다.
function ground(warmth, light) {
  const v = 12 + light * 220;
  const r = v + warmth * 14, g = v + warmth * 2, b = v - warmth * 14;
  return [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))));
}

let pan = null;
const trails = [];
const TRAIL_MS = 700;
let state = 'loading';
loadPan().then((p) => { pan = p; state = 'ready'; }).catch((e) => { state = 'error: ' + e.message; });

function draw() {
  const now = clock();
  const term = termAt(now);
  const alt = sunAltitude(now);
  const light = daylight(alt);
  const warmth = warmthAt(now);
  const speed = speedAt(now);
  const [r, g, b] = ground(warmth, light);
  const ink = light > 0.5 ? 20 : 235;

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, W, H);

  let segLabel = '';
  if (pan) {
    const v = virtualTime(now);
    const { people, segment } = poseAt(pan, v);
    segLabel = segment.bridge ? '(잇는 중)' : `${segment.source} · ${segment.label}`;
    const scale = Math.min(W, H) * 0.42 / pan.extent;
    const cx = W / 2, cy = H / 2;
    // 잔상: 사람마다 최근 위치를 기억해 옅어지는 선으로 그린다.
    const tNow = performance.now();
    people.forEach((p, i) => {
      const h = (trails[i] ??= []);
      h.push([cx + p[0] * scale, cy + p[1] * scale, tNow]);
      while (h.length && tNow - h[0][2] > TRAIL_MS) h.shift();
      for (let k = 1; k < h.length; k++) {
        const age = (tNow - h[k][2]) / TRAIL_MS;
        ctx.strokeStyle = `rgba(${ink},${ink},${ink},${(1 - age) * 0.35 * p[4]})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(h[k - 1][0], h[k - 1][1]); ctx.lineTo(h[k][0], h[k][1]); ctx.stroke();
      }
    });
    trails.length = people.length;
    people.forEach((p, i) => {
      const [x, y, heading, sitting, alpha] = p;
      const sx = cx + x * scale, sy = cy + y * scale;
      const rad = (i === 0 ? 5 : 3.2) * (sitting ? 0.6 : 1) * Math.max(0.8, scale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${ink},${ink},${ink})`;
      ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(heading) * rad * 2.4, sy + Math.sin(heading) * rad * 2.4); ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  if (showInfo) {
    const c = term.current, n = term.next;
    info.style.color = `rgb(${ink},${ink},${ink})`;
    info.textContent = [
      `${fmt(now)}${rate !== 1 ? `  ×${rate}` : ''}`,
      `${c.name} ${c.hanja}  ${fmt(c.at)} 부터  (${(term.progress * 100).toFixed(1)}%)`,
      `다음 ${n.name} ${n.hanja}  ${fmt(n.at)}`,
      `빠르기 ${speed.toFixed(3)}   따뜻함 ${warmth.toFixed(2)}   고창 해 높이 ${alt.toFixed(1)}°   밝기 ${light.toFixed(2)}`,
      pan ? `판 ${pan.files.join(', ')}  한 바퀴 ${(pan.length / 1000).toFixed(1)}초  ${segLabel}` : `판 ${state}`,
    ].join('\n');
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
