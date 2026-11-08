// 음력 날짜. 한국 음력 규칙대로 브라우저에서 계산한다.
//  - 한 달은 합삭(새달)이 든 날(한국 시각)에 시작한다.
//  - 동지가 든 달이 11월이다.
//  - 동지에서 다음 동지까지 달이 13개면, 중기(황경 30°의 배수)가 없는 첫 달이 윤달이다.
// 합삭 시각은 Meeus, Astronomical Algorithms 49장 식으로 구한다(오차 1분 안팎).
import { termsOfYear } from './jeolgi.js';

const DEG = Math.PI / 180;
const DAY = 86400000;
const KST = 9 * 3600000;
const dayOf = (ms) => Math.floor((ms + KST) / DAY); // 한국 시각 날짜 번호

const PLANET = [[299.77, 0.107408, 0.000325], [251.88, 0.016321, 0.000165], [251.83, 26.651886, 0.000164],
  [349.42, 36.412478, 0.000126], [84.66, 18.206239, 0.000110], [141.74, 53.303771, 0.000062],
  [207.14, 2.453732, 0.000060], [154.84, 7.306860, 0.000056], [34.52, 27.261239, 0.000047],
  [207.19, 0.121824, 0.000042], [291.34, 1.844379, 0.000040], [161.72, 24.198154, 0.000037],
  [239.56, 25.513099, 0.000035], [331.55, 3.592518, 0.000023]];

// k번째 합삭(k=0은 2000년 1월 6일)의 시각(유닉스 밀리초)
export function newMoon(k) {
  const T = k / 1236.85;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T ** 2 - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2;
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3) * DEG;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4) * DEG;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T ** 2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4) * DEG;
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3) * DEG;
  const s = Math.sin;
  jde += -0.4072 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F)
    + 0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M)
    - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
    - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
    - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M)
    + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F)
    + 0.00003 * s(2 * Mp + 2 * F) - 0.00003 * s(Mp + M + 2 * F) + 0.00003 * s(Mp - M + 2 * F)
    - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) + 0.00002 * s(4 * Mp);
  PLANET.forEach(([a, b, c], i) => { jde += c * s((a + b * k - (i === 0 ? 0.009173 * T * T : 0)) * DEG); });
  return (jde - 2440587.5) * DAY - 69.2 * 1000; // 지구시 → 세계시
}

const K0 = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC = 29.530588861 * DAY;

// 날짜 번호 d(한국 시각) 또는 그 이전에 든 마지막 합삭의 k
function kOnOrBefore(d) {
  let k = Math.floor(((d + 1) * DAY - KST - K0) / SYNODIC) + 1;
  while (dayOf(newMoon(k)) > d) k--;
  return k;
}

const winter = (y) => dayOf(termsOfYear(y).find((t) => t.longitude === 270).at); // 그해 동지 날
const m11 = new Map();
function month11(y) { // 그해 동지가 든 달(11월)의 첫 합삭 k
  if (!m11.has(y)) m11.set(y, kOnOrBefore(winter(y)));
  return m11.get(y);
}

const years = new Map();
function lunarYear(y) { // 그해 동지달부터 다음해 동지달 직전까지의 달 목록
  if (years.has(y)) return years.get(y);
  const k0 = month11(y), k1 = month11(y + 1);
  const starts = [];
  for (let k = k0; k <= k1; k++) starts.push(dayOf(newMoon(k)));
  const zhong = [y, y + 1].flatMap((yy) => termsOfYear(yy)).filter((t) => t.longitude % 30 === 0).map((t) => dayOf(t.at));
  const n = k1 - k0;
  let leap = -1;
  if (n === 13) {
    for (let i = 1; i < 13 && leap < 0; i++) {
      if (!zhong.some((z) => z >= starts[i] && z < starts[i + 1])) leap = i;
    }
  }
  const months = [];
  let num = 11;
  for (let i = 0; i < n; i++) {
    if (i > 0 && i !== leap) num = num % 12 + 1;
    months.push({ start: starts[i], end: starts[i + 1], month: num, leap: i === leap });
  }
  years.set(y, months);
  return months;
}

// 유닉스 밀리초 → { month, day, leap }
export function lunarDate(ms) {
  const d = dayOf(ms);
  const y = new Date(ms + KST).getUTCFullYear();
  const list = d >= lunarYear(y)[0].start ? lunarYear(y) : lunarYear(y - 1);
  const m = list.find((x) => d >= x.start && d < x.end);
  return { month: m.month, day: d - m.start + 1, leap: m.leap };
}
