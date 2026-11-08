// 앙부일구(仰釜日晷): 판을 해시계 판으로 본다.
// 판 가운데 아래에 영침(그림자 바늘)이 서 있고, 고창의 실제 해 위치로 그림자가 진다.
// 바늘 끝 그림자는 하루 동안 그날의 절기선을 따라 지나간다. 절기선은 실제 해시계 기하로 계산한다.
// 화면 위쪽이 북쪽이라고 둔다.
import { fromHourAngle, GOCHANG } from '../sun.js';
import { place, remember, hex, mix, rgb, clamp01, koDate } from './common.js';

const EPS = 23.4393;
const decOf = (lambda) => Math.asin(Math.sin(EPS * Math.PI / 180) * Math.sin(lambda * Math.PI / 180)) * 180 / Math.PI;

// 13개의 절기선. 해가 올라가는 쪽(동지→하지) 이름은 오른쪽 끝에, 내려오는 쪽 이름은 왼쪽 끝에 쓴다.
const RISING = ['冬至', '小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '淸明', '穀雨', '立夏', '小滿', '芒種', '夏至'];
const FALLING = ['冬至', '大雪', '小雪', '立冬', '霜降', '寒露', '秋分', '白露', '處暑', '立秋', '大暑', '小暑', '夏至'];
const LINES = RISING.map((_, j) => ({ dec: decOf(270 + 15 * j), right: RISING[j], left: FALLING[j], j }));

// 해 높이 alt, 방위 az일 때 높이 G인 바늘 끝 그림자의 위치(바늘 밑동 기준)
function tip(alt, az, G) {
  const L = G / Math.tan(alt * Math.PI / 180);
  const a = az * Math.PI / 180;
  return { x: -Math.sin(a) * L, y: Math.cos(a) * L };
}

let cache = null;
function geometry(W, H) {
  if (cache && cache.W === W && cache.H === H) return cache;
  const base = { x: W / 2, y: H * 0.86 };
  const G = Math.min(H * 0.43, W * 0.36);
  const inView = (p) => p.x > -W && p.x < 2 * W && p.y > -H && p.y < 2 * H;
  const lines = LINES.map((ln) => {
    const pts = [];
    for (let ha = -110; ha <= 110; ha += 1) {
      const s = fromHourAngle(ln.dec, ha, GOCHANG.lat);
      if (s.alt < 3) continue;
      const t = tip(s.alt, s.az, G);
      const p = { x: base.x + t.x, y: base.y + t.y };
      if (inView(p)) pts.push(p);
    }
    return { ...ln, pts };
  });
  // 시각선: 묘시부터 유시까지 한 시진(30분 간격의 반 시진 대신 1시간)마다
  const hours = [];
  for (let ha = -75; ha <= 75; ha += 15) {
    const pts = [];
    for (let d = -EPS; d <= EPS + 0.01; d += 0.5) {
      const s = fromHourAngle(d, ha, GOCHANG.lat);
      if (s.alt < 3) continue;
      const t = tip(s.alt, s.az, G);
      pts.push({ x: base.x + t.x, y: base.y + t.y });
    }
    hours.push(pts);
  }
  cache = { W, H, base, G, lines, hours };
  return cache;
}

const BRONZE_DAY = hex('#56604f');
const BRONZE_COLD = hex('#4e5a58');
const BRONZE_NIGHT = hex('#171c1a');
const SILVER = hex('#d3d6cf');

function polyline(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

export function draw(ctx, f, mem) {
  const { W, H } = f;
  const g = geometry(W, H);
  const day = mix(BRONZE_COLD, BRONZE_DAY, (f.warmth + 1) / 2);
  const ground = mix(BRONZE_NIGHT, day, 0.25 + 0.75 * f.light);
  ctx.fillStyle = rgb(ground); ctx.fillRect(0, 0, W, H);

  const inlay = 0.18 + 0.22 * f.light;

  // 시각선
  ctx.strokeStyle = rgb(SILVER, inlay * 0.45); ctx.lineWidth = 0.75;
  g.hours.forEach((pts) => polyline(ctx, pts));

  // 절기선과 이름
  const cur = f.term.current.hanja;
  ctx.textBaseline = 'middle';
  g.lines.forEach((ln) => {
    const on = ln.left === cur || ln.right === cur;
    ctx.strokeStyle = rgb(SILVER, on ? 0.85 : inlay); ctx.lineWidth = on ? 1.4 : 0.9;
    polyline(ctx, ln.pts);
    if (!f.fontsReady || ln.pts.length < 2) return;
    const a = ln.pts[0], b = ln.pts[ln.pts.length - 1];
    ctx.font = `${on ? 15 : 12}px Hanja300, serif`;
    ctx.fillStyle = rgb(SILVER, on ? 0.95 : inlay + 0.1);
    const lx = Math.max(14, Math.min(a.x, b.x) + 6);
    const rx = Math.min(W - 14, Math.max(a.x, b.x) - 6);
    const ly = a.x < b.x ? a.y : b.y, ry = a.x < b.x ? b.y : a.y;
    ctx.textAlign = 'left'; if (ly > 20 && ly < H - 20) ctx.fillText(ln.left, lx, ly - 9);
    ctx.textAlign = 'right'; if (ry > 20 && ry < H - 20) ctx.fillText(ln.right, rx, ry - 9);
  });

  const sunUp = f.sun.alt > 0.5;
  const shadow = `rgba(8,10,9,${0.55 * f.light})`;

  // 영침 그림자
  ctx.fillStyle = rgb(SILVER, 0.9);
  ctx.beginPath(); ctx.arc(g.base.x, g.base.y, 3, 0, Math.PI * 2); ctx.fill();
  if (sunUp) {
    const t = tip(Math.max(f.sun.alt, 2), f.sun.az, g.G);
    ctx.strokeStyle = shadow; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(g.base.x, g.base.y); ctx.lineTo(g.base.x + t.x, g.base.y + t.y); ctx.stroke();
    ctx.fillStyle = rgb(SILVER, 0.9);
    ctx.beginPath(); ctx.arc(g.base.x + t.x, g.base.y + t.y, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  // 판: 해시계 판 위에서 돈다. 사람마다 짧은 그림자.
  const { pts, scale } = place(f, W / 2, H * 0.47, 0.34);
  const trails = remember(mem, 'angbu', pts, f.tNow, 1200);
  trails.forEach((h) => {
    for (let k = 1; k < h.length; k++) {
      ctx.strokeStyle = rgb(SILVER, (1 - (f.tNow - h[k].t) / 1200) * 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(h[k - 1].x, h[k - 1].y); ctx.lineTo(h[k].x, h[k].y); ctx.stroke();
    }
  });
  const r = Math.max(2.4, 3.4 * scale);
  if (sunUp) {
    const len = Math.min(48, (7 * scale) / Math.tan(Math.max(f.sun.alt, 4) * Math.PI / 180));
    const a = f.sun.az * Math.PI / 180;
    ctx.strokeStyle = shadow; ctx.lineWidth = r * 1.4; ctx.lineCap = 'round';
    pts.forEach((p) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.sin(a) * len, p.y + Math.cos(a) * len); ctx.stroke(); });
  }
  pts.forEach((p, i) => {
    ctx.fillStyle = rgb(SILVER, p.alpha * (0.55 + 0.45 * Math.max(f.light, 0.35)));
    ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? r * 1.5 : r, 0, Math.PI * 2); ctx.fill();
  });

  // 글자
  if (f.fontsReady) {
    const ink = rgb(SILVER, 0.92);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ink;
    ctx.font = '40px SongMyung, serif';
    ctx.fillText(f.term.current.name, 24, H - 58);
    ctx.font = '14px SongMyung, serif';
    ctx.fillStyle = rgb(SILVER, 0.7);
    ctx.fillText(`다음 절기 ${f.term.next.name}, ${koDate(f.term.next.at)}`, 24, H - 30);
    if (f.status) ctx.fillText(f.status, 24, 34);
  }
}
