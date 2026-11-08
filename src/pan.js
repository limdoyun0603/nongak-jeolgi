// 판굿 녹화본을 불러와 하나의 끝없는 흐름으로 잇는다.
//
// 녹화본은 nongak-formations 레포의 recordings/ 폴더에 있는
// 'gochang-nongak-record' 형식 파일이다(진형 기록기의 💾 파일로 저장).
// 레포에 새 녹화본이 올라오면 다음 접속부터 자동으로 판에 들어온다.

// 데이터를 어디서 읽을지.
//   'snapshot' : 이 레포의 data/ 에 고정해 둔 녹화본만 쓴다(지금). 원래 레포가 바뀌어도 영향 없음.
//   'live'     : nongak-formations 레포의 최신 녹화본을 매번 읽는다.
export const MODE = 'snapshot';

export const SOURCE = {
  owner: 'limdoyun0603',
  repo: 'nongak-formations',
  branch: 'main',
  pages: 'https://limdoyun0603.github.io/nongak-formations/',
};

// 판의 순서. 파일 이름에 이 낱말이 들어가면 그 순서로 놓고, 없으면 이름순으로 뒤에 붙인다.
// recordings/index.json 이 있으면 그 목록을 우선한다.
const ORDER = ['ipjang', 'madang1', 'madang-1', '1madang', 'madang2', 'madang-2', '2madang', 'madang3', 'madang-3', '3madang', 'toejang'];

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function listRecordings() {
  // 1) 레포가 순서를 직접 적어 둔 경우
  try {
    const idx = await getJSON(SOURCE.pages + 'recordings/index.json');
    const files = Array.isArray(idx) ? idx : idx.files;
    if (Array.isArray(files) && files.length) return files.map((f) => (typeof f === 'string' ? f : f.file));
  } catch { /* 없으면 다음 방법 */ }
  // 2) GitHub API로 폴더 목록 읽기
  try {
    const items = await getJSON(`https://api.github.com/repos/${SOURCE.owner}/${SOURCE.repo}/contents/recordings?ref=${SOURCE.branch}`);
    const names = items.filter((it) => it.type === 'file' && it.name.endsWith('.json') && it.name !== 'index.json').map((it) => it.name);
    const rank = (n) => { const i = ORDER.findIndex((k) => n.toLowerCase().includes(k)); return i < 0 ? 99 : i; };
    return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  } catch { /* API 한도 초과 등 */ }
  // 3) 최소한 알고 있는 녹화본
  return ['ipjanggut.json'];
}

function validRecord(d) {
  return d && d.format === 'gochang-nongak-record' && Array.isArray(d.clips) && d.clips.some((c) => c.frames?.length > 1);
}

// 녹화본 하나 → 구간 목록. 좌표는 무대 중심을 원점으로 옮긴다.
function toSegments(rec, file) {
  const w = rec.stage?.width ?? 800, h = rec.stage?.height ?? 600;
  return rec.clips.filter((c) => c.frames?.length > 1).map((c, i) => {
    const n = c.frames.length;
    const times = Array.isArray(c.times) && c.times.length === n ? c.times.slice() : c.frames.map((_, k) => k * 17);
    const t0 = times[0];
    return {
      source: file,
      label: c.name ?? `동작 ${i + 1}`,
      joined: !!c.joined,
      instruments: rec.instruments ?? [],
      times: times.map((t) => t - t0),
      duration: times[n - 1] - t0,
      frames: c.frames.map((f) => f.map((p) => [p[0] - w / 2, p[1] - h / 2, p[2] ?? 0, p[4] ? 1 : 0])),
    };
  });
}

const maxMove = (a, b) => {
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  return m + Math.abs(a.length - b.length) * 100;
};

// 앞 구간의 끝과 다음 구간의 시작이 떨어져 있으면 그 사이를 잇는 이음 구간을 만든다.
// (진형 기록기는 버튼으로 바꾼 진형을 녹화하지 않아 녹화본 사이에 순간이동이 생긴다.)
function bridge(from, to) {
  const a = from.frames[from.frames.length - 1], b = to.frames[0];
  const d = maxMove(a, b);
  if (d < 6) return null;
  const duration = Math.min(6000, Math.max(1200, d * 9));
  return { source: null, label: '잇기', bridge: true, from: a, to: b, duration, instruments: to.instruments };
}

export async function loadPan() {
  // 미리보기용: 녹화본을 페이지 안에 넣어 둔 경우 그것을 쓴다(네트워크 없이).
  const preload = globalThis.PAN_PRELOAD;
  let files;
  if (preload) files = Object.keys(preload);
  else if (MODE === 'snapshot') files = (await getJSON('data/index.json')).copied.map((c) => c.file);
  else files = await listRecordings();
  const base = MODE === 'snapshot' ? 'data/' : SOURCE.pages + 'recordings/';
  const segments = [];
  const loaded = [];
  for (const f of files) {
    try {
      const rec = preload ? preload[f] : await getJSON(base + f);
      if (!validRecord(rec)) continue;
      segments.push(...toSegments(rec, f));
      loaded.push(f);
    } catch { /* 깨진 파일은 건너뜀 */ }
  }
  if (!segments.length) throw new Error('불러온 녹화본이 없습니다');

  // 구간 사이와 끝→처음을 잇는다.
  const seq = [];
  segments.forEach((s, i) => {
    seq.push(s);
    const next = segments[(i + 1) % segments.length];
    const b = bridge(s, next);
    if (b) seq.push(b);
  });
  let t = 0;
  for (const s of seq) { s.start = t; t += s.duration; }

  // 화면에 맞출 크기: 모든 녹화본에서 중심으로부터 가장 먼 거리.
  let extent = 1;
  for (const s of segments) for (const f of s.frames) for (const p of f) extent = Math.max(extent, Math.abs(p[0]), Math.abs(p[1]));

  return { seq, length: t, extent, files: loaded };
}

const ease = (x) => x * x * (3 - 2 * x);

function frameAt(seg, local) {
  if (seg.bridge) {
    const k = ease(Math.min(1, Math.max(0, local / seg.duration)));
    const n = Math.max(seg.from.length, seg.to.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = seg.from[i] ?? seg.to[i], b = seg.to[i] ?? seg.from[i];
      const dh = ((b[2] - a[2]) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      const alpha = i >= seg.from.length ? k : i >= seg.to.length ? 1 - k : 1;
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + dh * k, k < 0.5 ? a[3] : b[3], alpha]);
    }
    return out;
  }
  const t = seg.times;
  let lo = 0, hi = t.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= local) lo = m; else hi = m; }
  const span = t[hi] - t[lo] || 1;
  const k = Math.min(1, Math.max(0, (local - t[lo]) / span));
  const A = seg.frames[lo], B = seg.frames[hi];
  return A.map((a, i) => {
    const b = B[i] ?? a;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3], 1];
  });
}

// 판의 가상 시간 v(ms) → 그 순간의 사람들 [x, y, 방향, 앉음, 불투명도]
export function poseAt(pan, v) {
  const pos = ((v % pan.length) + pan.length) % pan.length;
  let lo = 0, hi = pan.seq.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pan.seq[m].start <= pos) lo = m; else hi = m - 1; }
  const seg = pan.seq[lo];
  return { people: frameAt(seg, pos - seg.start), segment: seg, position: pos };
}
