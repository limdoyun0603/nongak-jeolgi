// 화면. 계산(절기, 해, 판의 진행)은 다른 파일에 있고, 여기서는 매 프레임
// 그 값들을 모아 고른 그림(look)에 넘긴다.
//
// 주소 뒤에 붙이는 옵션
//   ?look=obang|angbu|non|check   그림 방식(시안 비교용)
//   ?at=2026-06-06T09:00          이 한국 시각부터 시작
//   ?rate=3600                    시간을 3600배 빠르게
//   ?info=1                       계산값 글자 보이기
//   #angbu-2026-06-06-10          미리보기 링크용 짧은 형식(그림, 시각 둘 다 생략 가능)

import { termAt } from './jeolgi.js';
import { sunPosition, daylight } from './sun.js';
import { speedAt, warmthAt, virtualTime } from './season.js';
import { loadPan, poseAt } from './pan.js';
import * as obang from './looks/obang.js';
import * as angbu from './looks/angbu.js';
import * as non from './looks/non.js';
import * as check from './looks/check.js';

const LOOKS = { obang, angbu, non, check };

const params = new URLSearchParams(location.search);
const hash = location.hash.match(/^#([a-z]+)?-?(?:(\d{4})-(\d\d)-(\d\d)(?:-(\d\d))?)?$/);
if (hash?.[1] && !params.get('look')) params.set('look', hash[1]);
if (hash?.[2] && !params.get('at')) params.set('at', `${hash[2]}-${hash[3]}-${hash[4]}T${hash[5] ?? '12'}:00`);

const startReal = Date.now();
const at = params.get('at');
const startClock = at ? Date.parse(at + (/[zZ]|[+-]\d\d:?\d\d$/.test(at) ? '' : '+09:00')) : startReal;
const rate = Number(params.get('rate')) || 1;
const clock = () => startClock + (Date.now() - startReal) * rate;
const look = LOOKS[params.get('look')] ?? LOOKS.angbu;

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const info = document.querySelector('#info');
info.hidden = params.get('info') !== '1';

let W = 0, H = 0;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

let pan = null;
let status = '판을 불러오는 중';
loadPan().then((p) => { pan = p; status = ''; }).catch(() => { status = '판을 불러오지 못했습니다. 새로고침해 주세요.'; });

const memory = {}; // 그림이 프레임 사이에 기억할 것(잔상, 발자국 등)
let fontsReady = false;
Promise.all(['SongMyung', 'GowunBatang', 'Hahmlet', '600 16px Hahmlet', 'Hanja300', 'Hanja500', 'Hanja900']
  .map((n) => document.fonts.load(n.includes(' ') ? n : `16px ${n}`, '절기節')))
  .catch(() => {}).finally(() => { fontsReady = true; });

function frame() {
  const now = clock();
  const sun = sunPosition(now);
  const f = {
    W, H, now, rate,
    term: termAt(now),
    sun, light: daylight(sun.alt),
    warmth: warmthAt(now), speed: speedAt(now),
    status, fontsReady, tNow: performance.now(),
    people: null, segment: null, extent: 1,
  };
  if (pan) {
    const pose = poseAt(pan, virtualTime(now));
    f.people = pose.people; f.segment = pose.segment; f.extent = pan.extent;
  }
  look.draw(ctx, f, memory);

  if (!info.hidden) {
    info.textContent = [
      new Date(now).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      `${f.term.current.name} ${(f.term.progress * 100).toFixed(1)}%  다음 ${f.term.next.name}`,
      `빠르기 ${f.speed.toFixed(3)}  따뜻함 ${f.warmth.toFixed(2)}  해 높이 ${sun.alt.toFixed(1)}°  방위 ${sun.az.toFixed(0)}°`,
      pan ? `${pan.files.join(', ')}  ${f.segment.bridge ? '잇는 중' : f.segment.label}` : status,
    ].join('\n');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
