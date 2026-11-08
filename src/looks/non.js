// 논: 고창 들판을 하늘에서 내려다본다. 가운데에 지금 절기 이름과 그 절기가 든 날(양력, 음력)을 쓴다.
// 논배미마다 조금씩 늦고 빠르게 철이 바뀐다: 그루터기 → 갈아엎은 흙 → 물 댄 논 → 모 → 푸른 벼 → 누런 벼 → 벤 논과 볏짚 뭉치 → 눈.
// 판은 그 위를 돈다. 물 댄 논에서는 물결이, 그 밖에는 발자국이 남는다.
import { place, hex, mix, rgb, smooth, clamp01 } from './common.js';
import { lunarDate } from '../lunar.js';

// 결정적인 난수(모든 접속자가 같은 들판을 본다)
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 입춘부터 센 절기 수 u(0..24)에 따른 논의 상태
// [u, 흙색, 물, 벼, 누런 정도, 눈, 고랑, 그루터기]
const KEYS = [
  [0, '#76634d', 0, 0, 0, 0.12, 0, 1],
  [2, '#6e5a45', 0, 0, 0, 0, 0, 1],
  [3.5, '#5a4535', 0, 0, 0, 0, 1, 0],
  [5, '#4b3b2d', 0.25, 0, 0, 0, 1, 0],
  [6, '#4b3b2d', 0.95, 0, 0, 0, 0, 0],
  [7, '#4b3b2d', 0.9, 0.22, 0, 0, 0, 0],
  [8.5, '#4b3b2d', 0.75, 0.5, 0, 0, 0, 0],
  [10, '#3f4a2c', 0.25, 0.9, 0, 0, 0, 0],
  [12, '#3f4a2c', 0, 1, 0, 0, 0, 0],
  [14, '#4a4a2c', 0, 1, 0.3, 0, 0, 0],
  [15.5, '#5a4f2e', 0, 1, 0.85, 0, 0, 0],
  [17, '#5a4f2e', 0, 1, 1, 0, 0, 0],
  [18.5, '#7a6650', 0, 0, 1, 0, 0, 1],
  [19.6, '#76634d', 0, 0, 1, 0.05, 0, 1],
  [20.6, '#76634d', 0, 0, 1, 0.85, 0, 1],
  [23, '#76634d', 0, 0, 1, 0.7, 0, 1],
  [24, '#76634d', 0, 0, 0, 0.12, 0, 1],
].map(([u, c, ...r]) => [u, hex(c), ...r]);

function stateAt(u) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= u) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smooth((u - a[0]) / (b[0] - a[0]));
  const L = (k) => a[k] + (b[k] - a[k]) * t;
  return { soil: mix(a[1], b[1], t), water: L(2), crop: L(3), gold: L(4), snow: L(5), furrow: L(6), stubble: L(7) };
}

const WATER = hex('#8d9a96');
const SPROUT = hex('#86b24c');
const GREEN = hex('#4f8a35');
const GOLD = hex('#c8a246');
const STRAW = hex('#b59a68');
const SNOW = hex('#eef0ee');
const BUND_GREEN = hex('#76994c');
const BUND_DRY = hex('#a3906c');

function layout(W, H) {
  const r = rng(1975);
  const S = Math.max(0.7, Math.min(W, H) / 800);
  const D = Math.hypot(W, H) / 2 + 60;
  const plots = [], roads = [];
  let x = -D, col = 0;
  while (x < D) {
    const w = (150 + r() * 120) * S;
    if (col % 4 === 3) { roads.push([x, x + 16 * S]); x += 16 * S; }
    let y = -D - r() * 80 * S;
    while (y < D) {
      const h = (70 + r() * 70) * S;
      const j = () => (r() - 0.5) * 7 * S;
      const harvest = 16.4 + r() * 1.6;
      const bales = [];
      if (r() < 0.55) {
        const n = 2 + Math.floor(r() * 6);
        for (let k = 0; k < n; k++) bales.push([x + 12 * S + r() * (w - 24 * S), y + 12 * S + r() * (h - 24 * S)]);
      }
      plots.push({ x0: x, x1: x + w, y0: y, y1: y + h, c: [[x + j(), y + j()], [x + w + j(), y + j()], [x + w + j(), y + h + j()], [x + j(), y + h + j()]],
        lag: r() * 1.1, harvest, bales, tint: (r() - 0.5) * 0.14, tilt: r() * Math.PI, along: w > h });
      y += h;
    }
    x += w; col++;
  }
  return { W, H, S, D, plots, roads, angle: -0.13 };
}

let geo = null, field = null, grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 160;
  const g = grainTile.getContext('2d'), img = g.createImageData(160, 160), r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return grainTile;
}

function paintField(W, H, u, sunAz) {
  if (!geo || geo.W !== W || geo.H !== H) geo = layout(W, H);
  if (!field) field = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  field.width = W * dpr; field.height = H * dpr;
  const c = field.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { S } = geo;
  c.translate(W / 2, H / 2); c.rotate(geo.angle);

  const base = stateAt(u);
  const green = smooth((u - 5) / 2) * (1 - smooth((u - 14) / 3));
  const bund = mix(mix(BUND_DRY, BUND_GREEN, green), SNOW, base.snow * 0.9);
  c.fillStyle = rgb(bund); c.fillRect(-geo.D, -geo.D, geo.D * 2, geo.D * 2);

  const sp = 5.2 * S; // 모줄 간격
  const shadowA = sunAz * Math.PI / 180 - geo.angle;
  for (const p of geo.plots) {
    const us = ((u - p.lag) % 24 + 24) % 24;
    const st = stateAt(us);
    const cut = us >= p.harvest && us < 23.9;
    if (cut) { st.crop = 0; st.stubble = 1; st.soil = mix(STRAW, st.soil, smooth((us - p.harvest) / 2)); }
    c.save();
    c.beginPath(); p.c.forEach(([x, y], i) => (i ? c.lineTo(x + 0, y) : c.moveTo(x, y))); c.closePath();
    // 논두렁 안쪽으로 조금 들인다
    c.clip();
    const inset = 4.2 * S;
    c.beginPath(); c.rect(p.x0 + inset, p.y0 + inset, p.x1 - p.x0 - inset * 2, p.y1 - p.y0 - inset * 2); c.clip();
    let ground = mix(st.soil, WATER, st.water);
    ground = ground.map((v) => v * (1 + p.tint));
    c.fillStyle = rgb(ground); c.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    // 논배미 안의 고르지 않은 빛(물 깊이, 흙 습기)
    const gx = Math.cos(p.tilt) * (p.x1 - p.x0) / 2, gy = Math.sin(p.tilt) * (p.y1 - p.y0) / 2;
    const mx = (p.x0 + p.x1) / 2, my = (p.y0 + p.y1) / 2;
    const gr = c.createLinearGradient(mx - gx, my - gy, mx + gx, my + gy);
    gr.addColorStop(0, `rgba(255,255,255,${0.05 + st.water * 0.08})`); gr.addColorStop(1, 'rgba(0,0,0,0.07)');
    c.fillStyle = gr; c.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);

    // 줄: 논배미의 긴 쪽을 따라
    const rows = [];
    if (p.along) for (let y = p.y0 + sp; y < p.y1; y += sp) rows.push([p.x0, y, p.x1, y]);
    else for (let x = p.x0 + sp; x < p.x1; x += sp) rows.push([x, p.y0, x, p.y1]);
    const stroke = (col, a, w, dash) => {
      c.strokeStyle = rgb(col, a); c.lineWidth = w; c.setLineDash(dash);
      c.beginPath(); rows.forEach(([a1, b1, a2, b2]) => { c.moveTo(a1, b1); c.lineTo(a2, b2); }); c.stroke();
    };
    if (st.furrow > 0.02) stroke([30, 22, 16], 0.35 * st.furrow, sp * 0.45, []);
    if (st.stubble > 0.02) stroke(STRAW, 0.55 * st.stubble, 1.3 * S, [1.3 * S, 2.6 * S]);
    if (st.crop > 0.02) {
      const col = mix(mix(SPROUT, GREEN, smooth(st.crop * 1.4 - 0.2)), GOLD, st.gold);
      const k = st.crop;
      stroke(col, 0.95, sp * (0.22 + 0.78 * k), k > 0.85 ? [] : [1.6 * S + 4 * k * S, (2.4 - 2 * k) * S]);
    }
    c.setLineDash([]);
    if (st.snow > 0.01) { c.fillStyle = rgb(SNOW, st.snow * 0.92); c.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0); }
    c.restore();

    // 볏짚 뭉치(곤포): 벤 뒤 대설 무렵까지
    if (cut && p.bales.length && us < 21) {
      const show = smooth((us - p.harvest - 0.3) / 0.4);
      const r = 5.5 * S;
      p.bales.forEach(([bx, by]) => {
        c.fillStyle = `rgba(20,20,16,${0.3 * show})`;
        c.beginPath(); c.arc(bx - Math.sin(shadowA) * r * 0.8, by + Math.cos(shadowA) * r * 0.8, r, 0, Math.PI * 2); c.fill();
        c.fillStyle = rgb(mix([244, 244, 238], SNOW, base.snow), show);
        c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.fill();
      });
    }
  }
  // 논두렁 그늘
  c.strokeStyle = 'rgba(30,25,15,0.18)'; c.lineWidth = 1;
  for (const p of geo.plots) { c.beginPath(); p.c.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); }
  // 농로
  geo.roads.forEach(([a, b]) => {
    c.fillStyle = rgb(mix(hex('#b8ad94'), SNOW, base.snow * 0.8)); c.fillRect(a, -geo.D, b - a, geo.D * 2);
    c.fillStyle = 'rgba(80,70,50,0.18)'; c.fillRect(a + (b - a) * 0.22, -geo.D, (b - a) * 0.12, geo.D * 2); c.fillRect(a + (b - a) * 0.66, -geo.D, (b - a) * 0.12, geo.D * 2);
  });
  // 거친 결: 화면 전체에 옅은 알갱이
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.globalAlpha = 0.07; c.fillStyle = c.createPattern(grain(), 'repeat'); c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  return { water: base.water * (1 - base.crop * 0.8), snow: base.snow };
}

const TEXT = '#fbfaf5';

export function draw(ctx, f, mem) {
  const { W, H } = f;
  const u = ((f.term.current.index - 21 + 24) % 24) + f.term.progress;
  const m = (mem.non ??= { u: -1, at: 0, W: 0, H: 0, stamps: [], last: [], info: null, dates: null });
  if (m.W !== W || m.H !== H || Math.abs(m.u - u) > 0.004 || f.tNow - m.at > 60000) {
    m.info = paintField(W, H, u, f.sun.az);
    m.u = u; m.at = f.tNow; m.W = W; m.H = H;
  }
  ctx.drawImage(field, 0, 0, W, H);

  // 판
  const { pts, scale } = place(f, W / 2, H / 2, 0.5);
  const wet = m.info.water > 0.4;
  pts.forEach((p, i) => {
    const l = m.last[i];
    if (l && Math.hypot(l.x - p.x, l.y - p.y) > 80) m.last[i] = null;
    const step = (wet ? 30 : 7) * Math.max(1, scale);
    if (!m.last[i] || Math.hypot(m.last[i].x - p.x, m.last[i].y - p.y) > step) {
      const side = (m.last[i]?.side ?? 1) * -1;
      m.stamps.push({ x: p.x, y: p.y, a: p.heading, side, t: f.tNow, wet });
      m.last[i] = { x: p.x, y: p.y, side };
    }
  });
  while (m.stamps.length && (m.stamps.length > 3000 || f.tNow - m.stamps[0].t > (m.stamps[0].wet ? 4000 : 30000))) m.stamps.shift();
  const S = Math.max(1, scale);
  m.stamps.forEach((s) => {
    const age = (f.tNow - s.t) / (s.wet ? 4000 : 30000);
    if (s.wet) {
      ctx.strokeStyle = `rgba(235,240,236,${(1 - age) * 0.35})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(s.x, s.y, 3 + age * 13 * S, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = m.info.snow > 0.3 ? `rgba(120,125,130,${(1 - age) * 0.5})` : `rgba(25,20,14,${(1 - age) * 0.2})`;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a ?? 0);
      ctx.beginPath(); ctx.ellipse(0, s.side * 1.6 * S, 2.4 * S, 1.2 * S, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  });

  // 사람: 흰 옷, 위에서 본 머리와 어깨. 해 반대쪽으로 그림자.
  const a = f.sun.az * Math.PI / 180;
  const len = f.sun.alt > 1 ? Math.min(14, 3.5 / Math.tan(Math.max(f.sun.alt, 8) * Math.PI / 180)) * S : 0;
  const r = Math.max(2.6, 3 * scale);
  pts.forEach((p) => {
    if (len) { ctx.fillStyle = `rgba(15,15,10,${0.35 * f.light * p.alpha})`; ctx.beginPath(); ctx.ellipse(p.x - Math.sin(a) * len, p.y + Math.cos(a) * len, r, r * 0.8, a, 0, Math.PI * 2); ctx.fill(); }
  });
  pts.forEach((p, i) => {
    ctx.fillStyle = `rgba(250,249,244,${p.alpha})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? r * 1.25 : r, 0, Math.PI * 2); ctx.fill();
    if (i === 0) { ctx.fillStyle = `rgba(250,249,244,${p.alpha * 0.9})`; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.1, 0, Math.PI * 2); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.stroke(); }
  });

  // 빛: 밤에는 푸르게 가라앉고, 해 뜨고 질 무렵에는 조금 붉다
  const night = 1 - f.light;
  if (night > 0.01) { ctx.fillStyle = `rgba(8,14,28,${night * 0.62})`; ctx.fillRect(0, 0, W, H); }
  const dusk = Math.max(0, 1 - Math.abs(f.sun.alt - 2) / 9) * 0.16;
  if (dusk > 0.01) { ctx.fillStyle = `rgba(214,120,60,${dusk})`; ctx.fillRect(0, 0, W, H); }

  // 가운데 글자
  if (f.fontsReady) {
    const t = f.term.current;
    if (!m.dates || m.dates.at !== t.at) {
      const d = new Date(t.at + 9 * 3600000), l = lunarDate(t.at);
      m.dates = { at: t.at, solar: `양력 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`, lunar: `음력 ${l.leap ? '윤' : ''}${l.month}월 ${l.day}일` };
    }
    const size = Math.round(Math.max(56, Math.min(W * 0.12, H * 0.15)));
    const small = Math.round(size * 0.32);
    const cy = H * 0.5;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = size * 0.18; ctx.shadowOffsetY = size * 0.02;
    ctx.fillStyle = TEXT;
    ctx.font = `700 ${size}px GowunBatang, serif`;
    ctx.letterSpacing = `${Math.round(size * 0.12)}px`;
    ctx.fillText(t.name, W / 2 + size * 0.06, cy);
    ctx.font = `700 ${small}px GowunBatang, serif`;
    ctx.letterSpacing = `${Math.round(small * 0.08)}px`;
    ctx.fillText(m.dates.solar, W / 2, cy + small * 1.75);
    ctx.fillText(m.dates.lunar, W / 2, cy + small * 3.25);
    if (f.status) { ctx.font = `400 15px GowunBatang, serif`; ctx.letterSpacing = '0px'; ctx.fillText(f.status, W / 2, cy + small * 5); }
    ctx.restore();
  }
}
