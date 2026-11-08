// 그림들이 함께 쓰는 도구.

// 판 좌표(무대 중심 원점) → 화면 좌표. 판이 화면의 짧은 변에서 차지할 비율 fill.
export function place(f, cx, cy, fill = 0.42) {
  const scale = Math.min(f.W, f.H) * fill / f.extent;
  return {
    scale,
    pts: (f.people ?? []).map((p) => ({ x: cx + p[0] * scale, y: cy + p[1] * scale, heading: p[2], sitting: p[3], alpha: p[4] })),
  };
}

export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const rgb = (c, a = 1) => `rgba(${c.map((v) => Math.round(v)).join(',')},${a})`;
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const smooth = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

// 한국 시각 날짜 문자열. "11월 7일 오후 6시 52분"
export function koDate(ms, { minutes = true } = {}) {
  const d = new Date(ms + 9 * 3600000);
  const h = d.getUTCHours();
  const ap = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${ap} ${hh}시` + (minutes ? ` ${d.getUTCMinutes()}분` : '');
}

// 사람마다 최근 위치 기록. keepMs보다 오래된 것은 버린다.
export function remember(mem, key, pts, tNow, keepMs) {
  const trails = (mem[key] ??= []);
  pts.forEach((p, i) => {
    const h = (trails[i] ??= []);
    const last = h[h.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) > 80) h.length = 0; // 순간이동은 잇지 않음
    h.push({ x: p.x, y: p.y, t: tNow });
    while (h.length && tNow - h[0].t > keepMs) h.shift();
  });
  trails.length = pts.length;
  return trails;
}
