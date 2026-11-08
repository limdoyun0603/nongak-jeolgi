// 논: 고창 들판을 위에서 내려다본다. 절기마다 땅빛이 바뀌고(갈아엎은 흙 → 모 → 푸른 벼 → 누런 벼 → 눈),
// 판이 지나간 자리에 발자국이 30초쯤 남는다.
import { place, hex, mix, rgb, koDate } from './common.js';

// 절기 번호 0=춘분 … 23=경칩 순서
const SOIL = ['#7a6a3e', '#6f7c3e', '#5e8a3a', '#4f8a3c', '#8c8e3e', '#8a9a9c', '#6f9282', '#4e8250', '#3e7444', '#3b6e3e', '#4a7440', '#6e8238',
  '#a08e3a', '#b8933a', '#8e7146', '#7a6650', '#8a8578', '#b9bcb8', '#c8cbc7', '#bfc2be', '#a9aba6', '#6e5a48', '#6a5644', '#74593f'].map(hex);

const STAMP_MS = 30000, STAMP_MAX = 3000, STEP_PX = 9;

function fieldColor(term) {
  const i = term.current.index;
  return mix(SOIL[i], SOIL[(i + 1) % 24], term.progress);
}

export function draw(ctx, f, mem) {
  const { W, H } = f;
  const field = fieldColor(f.term);
  const lum = (field[0] * 0.3 + field[1] * 0.59 + field[2] * 0.11) / 255;
  const ground = mix([10, 12, 14], field, 0.18 + 0.82 * f.light);
  ctx.fillStyle = rgb(ground); ctx.fillRect(0, 0, W, H);

  // 고랑: 가로로 옅은 줄
  const dark = lum > 0.6 ? [60, 60, 56] : [0, 0, 0];
  ctx.strokeStyle = rgb(dark, 0.07 + 0.05 * f.light); ctx.lineWidth = 2;
  const gap = 14;
  for (let y = gap / 2; y < H; y += gap) { ctx.beginPath(); ctx.moveTo(0, y + Math.sin(y * 0.013) * 3); ctx.lineTo(W, y - Math.sin(y * 0.011) * 3); ctx.stroke(); }

  const { pts, scale } = place(f, W / 2, H / 2, 0.5);
  const st = (mem.non ??= { stamps: [], last: [] });
  pts.forEach((p, i) => {
    const l = st.last[i];
    if (l && Math.hypot(l.x - p.x, l.y - p.y) > 80) st.last[i] = null;
    if (!st.last[i] || Math.hypot(st.last[i].x - p.x, st.last[i].y - p.y) > STEP_PX * Math.max(1, scale)) {
      const side = (st.last[i]?.side ?? 1) * -1;
      st.stamps.push({ x: p.x, y: p.y, a: p.heading, side, t: f.tNow });
      st.last[i] = { x: p.x, y: p.y, side };
    }
  });
  while (st.stamps.length && (st.stamps.length > STAMP_MAX || f.tNow - st.stamps[0].t > STAMP_MS)) st.stamps.shift();

  const print = lum > 0.6 ? [70, 68, 60] : mix(field, [0, 0, 0], 0.55);
  const fw = Math.max(1.4, 1.9 * scale), fl = fw * 1.9;
  st.stamps.forEach((s) => {
    const age = (f.tNow - s.t) / STAMP_MS;
    ctx.fillStyle = rgb(print, (1 - age) * 0.55 * (0.4 + 0.6 * f.light));
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a ?? 0);
    ctx.beginPath(); ctx.ellipse(0, s.side * fw * 1.1, fl, fw, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // 사람: 작은 원(위에서 본 머리)
  const head = lum > 0.6 ? [34, 32, 28] : [240, 236, 222];
  pts.forEach((p, i) => {
    ctx.fillStyle = rgb(head, p.alpha * (0.6 + 0.4 * Math.max(f.light, 0.4)));
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2.6, 3.2 * scale) * (i === 0 ? 1.35 : 1), 0, Math.PI * 2); ctx.fill();
  });

  if (f.fontsReady) {
    const ink = lum > 0.6 && f.light > 0.4 ? [30, 30, 26] : [244, 240, 228];
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgb(ink, 0.92);
    ctx.font = '30px GowunBatang, serif';
    ctx.fillText(f.term.current.name, 28, H - 48);
    const w = ctx.measureText(f.term.current.name).width;
    ctx.font = '16px Hanja500, serif';
    ctx.fillStyle = rgb(ink, 0.6);
    ctx.fillText(f.term.current.hanja, 28 + w + 10, H - 48);
    ctx.font = '14px GowunBatang, serif';
    ctx.fillText(koDate(f.now), 28, H - 24);
    if (f.status) ctx.fillText(f.status, 28, 36);
  }
}
