// 오방(五方): 계절마다 바탕이 오방색 하나로 바뀐다. 봄 청, 여름 적, 늦여름 황, 가을 백, 겨울 흑.
// 사람은 상모 끈처럼 지나온 길을 끌고 다닌다. 오른쪽 끝에 지금 절기의 한자를 크게 세운다.
import { place, remember, hex, mix, rgb, smooth, koDate } from './common.js';

// 절기 번호(0=춘분 … 23=경칩)마다 어느 방위색에 속하는지. 입춘(21)~곡우(2) 청, 입하(3)~하지(6) 적, 소서(7)~대서(8) 황, 입추(9)~상강(14) 백, 입동(15)~대한(20) 흑
const SEASON = [0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 0, 0, 0];
const GROUND = ['#1f3b57', '#8e2a1e', '#b8892b', '#e4e6e3', '#000000'].map(hex);
// 각 바탕 위의 끈 색과 글자 색
const RIBBON = ['#e9e4d4', '#f1d9b8', '#2a1d10', '#14181c', '#e4e6e3'].map(hex);
const RIBBON_ALT = ['#c9a640', '#1f3b57', '#8e2a1e', '#8e2a1e', '#b8892b'].map(hex); // 상쇠 부포

function groundAt(term) {
  const i = term.current.index;
  const a = SEASON[i], b = SEASON[(i + 1) % 24];
  // 계절이 바뀌는 절기의 마지막 1/3 동안 다음 색으로 넘어간다
  const t = a === b ? 0 : smooth((term.progress - 0.66) / 0.34);
  return { g: mix(GROUND[a], GROUND[b], t), r: mix(RIBBON[a], RIBBON[b], t), alt: mix(RIBBON_ALT[a], RIBBON_ALT[b], t) };
}

const KEEP = 1600;

export function draw(ctx, f, mem) {
  const { W, H } = f;
  const c = groundAt(f.term);
  // 밤에는 조금 가라앉는다(흑은 그대로)
  const night = 1 - f.light;
  const ground = mix(c.g, [0, 0, 0], night * 0.45);
  ctx.fillStyle = rgb(ground); ctx.fillRect(0, 0, W, H);

  // 절기 한자: 오른쪽 끝, 위에서 아래로, 잘려도 된다
  if (f.fontsReady) {
    const size = Math.min(H * 0.42, W * 0.3);
    ctx.font = `${size}px Hanja900, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = rgb(c.r, 0.1 + 0.05 * f.light);
    const x = W - size * 0.38;
    [...f.term.current.hanja].forEach((ch, k) => ctx.fillText(ch, x, H * 0.5 + (k - 0.5) * size * 1.02));
  }

  const { pts, scale } = place(f, W * 0.44, H * 0.5, 0.46);
  const trails = remember(mem, 'obang', pts, f.tNow, KEEP);
  const width = Math.max(2, 4.2 * scale);
  ctx.lineCap = 'round';
  trails.forEach((h, i) => {
    const col = i === 0 ? c.alt : c.r;
    for (let k = 1; k < h.length; k++) {
      const age = (f.tNow - h[k].t) / KEEP; // 0 새것 … 1 오래된 것
      const sway = Math.sin(h[k].t / 140 + i) * age * 3 * scale;
      const dx = h[k].x - h[k - 1].x, dy = h[k].y - h[k - 1].y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d * sway, ny = dx / d * sway;
      ctx.strokeStyle = rgb(col, (1 - age) * 0.9 * pts[i].alpha);
      ctx.lineWidth = width * (1 - age * 0.85);
      ctx.beginPath(); ctx.moveTo(h[k - 1].x + nx, h[k - 1].y + ny); ctx.lineTo(h[k].x + nx, h[k].y + ny); ctx.stroke();
    }
  });
  pts.forEach((p, i) => {
    ctx.fillStyle = rgb(i === 0 ? c.alt : c.r, p.alpha);
    ctx.beginPath(); ctx.arc(p.x, p.y, width * (i === 0 ? 1.4 : 0.9), 0, Math.PI * 2); ctx.fill();
  });

  if (f.fontsReady) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgb(c.r, 0.9);
    ctx.font = '600 22px Hahmlet, serif';
    ctx.fillText(f.term.current.name, 28, H - 52);
    ctx.font = '14px Hahmlet, serif';
    ctx.fillStyle = rgb(c.r, 0.65);
    ctx.fillText(koDate(f.now), 28, H - 28);
    if (f.status) ctx.fillText(f.status, 28, 36);
  }
}
