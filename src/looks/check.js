// 확인용 그림: 점과 선, 회색조 바탕. 엔진을 점검할 때 쓴다.
import { place, remember } from './common.js';

export function draw(ctx, f, mem) {
  const v = 12 + f.light * 220;
  ctx.fillStyle = `rgb(${v + f.warmth * 14},${v + f.warmth * 2},${v - f.warmth * 14})`;
  ctx.fillRect(0, 0, f.W, f.H);
  const ink = f.light > 0.5 ? 20 : 235;
  const { pts, scale } = place(f, f.W / 2, f.H / 2);
  const trails = remember(mem, 'check', pts, f.tNow, 700);
  trails.forEach((h) => {
    for (let k = 1; k < h.length; k++) {
      ctx.strokeStyle = `rgba(${ink},${ink},${ink},${(1 - (f.tNow - h[k].t) / 700) * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(h[k - 1].x, h[k - 1].y); ctx.lineTo(h[k].x, h[k].y); ctx.stroke();
    }
  });
  pts.forEach((p, i) => {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = `rgb(${ink},${ink},${ink})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, (i === 0 ? 5 : 3.2) * Math.max(0.8, scale), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
}
