// 고창의 실제 해 높이(고도각). 화면의 밝기에 쓴다.
// NOAA 태양 위치 근사식. 오차 수 분각 수준이라 밝기 계산에는 충분하다.

export const GOCHANG = { lat: 35.4358, lon: 126.7019 }; // 고창군청 부근

const RAD = Math.PI / 180;

export function sunAltitude(ms, { lat, lon } = GOCHANG) {
  const jd = ms / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15 + lon) * RAD;
  const ha = lst - ra;
  const alt = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha));
  return alt / RAD;
}

// 해 높이 → 밝기 0..1. 해가 지평선 아래 18°(천문박명)보다 낮으면 0, 15° 위면 1.
export function daylight(altitude) {
  const t = (altitude + 18) / 33;
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
