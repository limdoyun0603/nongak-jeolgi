// 절기마다 달라지는 판의 변수: 빠르기와 따뜻함.
//
// 빠르기는 작가의 해석이다. 판굿 원형에는 절기별 빠르기가 없다.
// 농사일이 바쁜 때 판이 빨라지고, 땅이 쉬는 겨울에 느려지도록 정했다.
// 값은 각 절기가 시작되는 순간의 배속이고, 절기 사이에서는 부드럽게 이어진다.
// 1 = 녹화한 그대로의 빠르기.

export const SPEED = {
  입춘: 0.75, 우수: 0.80, 경칩: 0.88,   // 언 땅이 풀리고 일을 채비함
  춘분: 0.95, 청명: 1.00, 곡우: 1.08,   // 밭갈이, 볍씨 담그기
  입하: 1.15, 소만: 1.20, 망종: 1.30,   // 모내기. 한 해 중 가장 바쁨
  하지: 1.25, 소서: 1.15, 대서: 1.10,   // 김매기
  입추: 1.05, 처서: 1.00, 백로: 1.05,   // 김매기를 마치고 한숨 돌림
  추분: 1.15, 한로: 1.20, 상강: 1.15,   // 거두기
  입동: 0.95, 소설: 0.85, 대설: 0.75,   // 갈무리
  동지: 0.65, 소한: 0.62, 대한: 0.60,   // 땅이 쉼
};

import { termAt, termsOfYear } from './jeolgi.js';

const DAY = 86400000;

// 따뜻함 -1..1. 이름 그대로 대한(大寒)이 가장 춥고 대서(大暑)가 가장 덥다고 두고,
// 그 사이를 코사인으로 잇는다. 실제 기온이 아니라 절기가 뜻하는 계절감이다.
export function warmthAt(ms) {
  const { list, position } = termAt(ms);
  const coldest = [...list].reverse().find((t) => t.name === '대한' && t.at <= ms)
    ?? list.find((t) => t.name === '대한');
  const yearLen = 365.2422 * DAY;
  const phase = ((ms - coldest.at) / yearLen) % 1;
  return -Math.cos(phase * 2 * Math.PI);
}

// 시각 ms의 빠르기. 이번 절기 시작값에서 다음 절기 시작값으로 선형으로 옮겨 간다.
export function speedAt(ms) {
  const { current, next, progress } = termAt(ms);
  return SPEED[current.name] + (SPEED[next.name] - SPEED[current.name]) * progress;
}

// 판의 가상 시간(ms). 기준 시각부터 빠르기를 적분한 값이라,
// 같은 순간에 접속한 사람은 모두 판의 같은 장면을 본다.
const EPOCH = Date.UTC(2026, 0, 1) - 9 * 3600000; // 2026-01-01 00:00 한국 시각

function boundaries(fromMs, toMs) {
  const y0 = new Date(Math.min(fromMs, toMs)).getUTCFullYear() - 1;
  const y1 = new Date(Math.max(fromMs, toMs)).getUTCFullYear() + 1;
  const out = [];
  for (let y = y0; y <= y1; y++) out.push(...termsOfYear(y));
  return out;
}

function integrate(a, b) {
  // a < b. 절기 경계에서 끊어 각 구간을 사다리꼴로 정확히 적분(빠르기가 구간 안에서 선형이므로 정확함).
  const marks = boundaries(a, b).map((t) => t.at).filter((t) => t > a && t < b);
  const pts = [a, ...marks, b];
  let v = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const s0 = speedAt(pts[i]);
    const s1 = speedAt(pts[i + 1] - 1);
    v += (s0 + s1) / 2 * (pts[i + 1] - pts[i]);
  }
  return v;
}

let memo = { at: EPOCH, v: 0 };

export function virtualTime(ms) {
  if (ms >= memo.at && ms - memo.at < 20 * DAY) {
    const v = memo.v + integrate(memo.at, ms);
    if (ms - memo.at > DAY) memo = { at: ms, v };
    return v;
  }
  const v = ms >= EPOCH ? integrate(EPOCH, ms) : -integrate(ms, EPOCH);
  memo = { at: ms, v };
  return v;
}
