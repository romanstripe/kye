// @ts-nocheck  (약지 폭 재기: 순수 계산, 화면·three 와 무관)
import type { SkinMask } from './skin.ts'

const IW = 480, IH = 854   // 프레임 좌표계 (분석 때 맞춘 크기)

export const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
// 손가락 폭 재기: 손가락 가운데에서 손가락에 수직으로 걸어가며 양쪽 경계를 찾음.
//  - 이웃 손가락이 있는 쪽: 이웃 손가락 선(예: 중지 9→10)까지만 걷고, 그 안에서 경계를 찾음
//  - 이웃이 없는 바깥쪽(검지·소지·엄지의 반대편): 이웃 쪽에서 잰 길이의 k배까지만 걸음 (엄지는 굵어서 k 를 더 크게)
//  - 경계 = 구간 안에서 마스크가 끝나는 곳, 마스크가 끝까지 이어지면(손가락이 붙음) 밝기가 가장 어두운 곳(손가락 사이 틈)
export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const
export type Finger = (typeof FINGERS)[number]
export const FINGER_NAME: Record<Finger, string> = { thumb: '엄지', index: '검지', middle: '중지', ring: '약지', pinky: '소지' }
export const JOINT: Record<Finger, [number, number]> = { thumb: [2, 3], index: [5, 6], middle: [9, 10], ring: [13, 14], pinky: [17, 18] }
// pos = +n 쪽 이웃(선 있음), neg = -n 쪽 이웃(없으면 바깥쪽), k = 바깥쪽 걷는 한도 배수
const NEIGH: Record<Finger, { pos: Finger; neg: Finger | null; k: number }> = {
  thumb: { pos: 'index', neg: null, k: 2.2 },
  index: { pos: 'middle', neg: null, k: 1.5 },
  middle: { pos: 'ring', neg: 'index', k: 1.5 },
  ring: { pos: 'middle', neg: 'pinky', k: 1.5 },
  pinky: { pos: 'ring', neg: null, k: 1.5 },
}

function measureFinger(L, m: SkinMask, f: Finger) {
  const [ia, ib] = JOINT[f], a = L[ia], b = L[ib], c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, u = [dx / len, dy / len]
  const { pos, neg, k } = NEIGH[f]
  let n = [-u[1], u[0]]
  const R = L[JOINT[pos][0]]
  if ((R[0] - c[0]) * n[0] + (R[1] - c[1]) * n[1] < 0) n = [-n[0], -n[1]]   // +n = pos 이웃 쪽
  const hit = (P, Q) => { const d = [Q[0] - P[0], Q[1] - P[1]], den = n[0] * d[1] - n[1] * d[0]; return Math.abs(den) < 1e-6 ? null : ((P[0] - c[0]) * d[1] - (P[1] - c[1]) * d[0]) / den }
  const line = (g: Finger) => hit(L[JOINT[g][0]], L[JOINT[g][1]])
  const sM = line(pos), sN = neg ? line(neg) : null
  if (sM == null || sM <= 2 || (neg && (sN == null || sN >= -2))) return { c, n, w: null, limM: 60, limP: 60 }
  const limM = sM
  let limP = neg ? -sN : k * limM   // 바깥쪽은 이웃 쪽 길이의 k배 (이웃 쪽을 잰 뒤 다시 정함)
  const fail = () => ({ c, n, w: null, limM, limP })
  const skin = (x, y) => { const ix = Math.floor(x * m.w / IW), iy = Math.floor(y * m.h / IH); return ix >= 0 && iy >= 0 && ix < m.w && iy < m.h && m.data[iy * m.w + ix] === 1 }
  const lumaAt = (x, y) => { let t = 0; for (const o of [-2, 0, 2]) { const ix = Math.round((x + u[0] * o) * m.lw / IW), iy = Math.round((y + u[1] * o) * m.lh / IH); t += ix >= 0 && iy >= 0 && ix < m.lw && iy < m.lh ? m.luma[iy * m.lw + ix] : 255 } return t / 3 }
  if (!skin(c[0], c[1])) return fail()
  const side = (sg, lim) => {
    let s = 0; while (s < lim && skin(c[0] + n[0] * sg * (s + 0.25), c[1] + n[1] * sg * (s + 0.25))) s += 0.25
    if (s < lim - 0.25) return { s, kind: '마스크' }
    const prof = []; for (let t = 0.3 * lim; t <= 0.85 * lim; t += 0.5) prof.push([t, lumaAt(c[0] + n[0] * sg * t, c[1] + n[1] * sg * t)])
    if (prof.length < 5) return null
    const sm = prof.map((_, i) => { let q = 0, kk = 0; for (let j = -2; j <= 2; j++) { const e = prof[i + j]; if (e) { q += e[1]; kk++ } } return q / kk })
    let bi = 0; sm.forEach((v, i) => { if (v < sm[bi]) bi = i })
    if (sm[bi] > 0.85 * median(sm)) return null   // 뚜렷하게 어두운 곳이 없으면 못 잡은 것
    return { s: prof[bi][0], kind: '어두움' }
  }
  const rM = side(1, limM); if (!rM) return fail()
  if (!neg) limP = k * rM.s   // 바깥쪽 한도: 이웃 쪽에서 잰 길이 기준
  if (limP < 2) return fail()
  const rP = side(-1, limP); if (!rP) return fail()
  return { c, n, limM, limP, w: rM.s + rP.s, A: [c[0] - n[0] * rP.s, c[1] - n[1] * rP.s], B: [c[0] + n[0] * rM.s, c[1] + n[1] * rM.s], kindM: rM.kind, kindP: rP.kind }
}
const skinAt = (m: SkinMask, x, y) => { const ix = Math.floor(x * m.w / IW), iy = Math.floor(y * m.h / IH); return ix >= 0 && iy >= 0 && ix < m.w && iy < m.h && m.data[iy * m.w + ix] === 1 }
// 갈라지는 곳: 이웃 손가락과의 틈(마스크가 비어 있는 곳)이 끝나는 지점.
//  두 손가락 시작 관절의 가운데에서, 두 손가락 방향의 평균 방향으로, 둘째 마디 높이부터 손바닥 쪽으로 걸어가며
//  틈(4px 이상 이어진 빈 곳)을 지나 처음 피부를 만나는 곳. 양쪽 이웃이 다 있으면 더 위쪽(손가락 끝 쪽)을 씀.
//  못 찾으면(손가락이 붙어 있거나 이웃이 없는 바깥쪽) null. web=점(px), webT=시작 관절→다음 관절 길이 대비 위치(0=시작 관절)
function findWeb(L, m: SkinMask, f: Finger) {
  const [ia, ib] = JOINT[f], af = L[ia], bf = L[ib]
  const dx = bf[0] - af[0], dy = bf[1] - af[1], lf = Math.hypot(dx, dy) || 1
  let best = null
  for (const g of [NEIGH[f].pos, NEIGH[f].neg]) {
    if (!g) continue
    const ag = L[JOINT[g][0]], bg = L[JOINT[g][1]], gx = bg[0] - ag[0], gy = bg[1] - ag[1], lg = Math.hypot(gx, gy) || 1
    let ux = dx / lf + gx / lg, uy = dy / lf + gy / lg; const un = Math.hypot(ux, uy) || 1; ux /= un; uy /= un
    const ox = (af[0] + ag[0]) / 2, oy = (af[1] + ag[1]) / 2
    let run = 0, hit = null
    for (let s = ((bf[0] + bg[0]) / 2 - ox) * ux + ((bf[1] + bg[1]) / 2 - oy) * uy; s > -0.3 * lf; s -= 1) {
      if (!skinAt(m, ox + ux * s, oy + uy * s)) run++
      else if (run >= 4) { hit = s + 0.5; break } else run = 0
    }
    if (hit == null) continue
    const web = [ox + ux * hit, oy + uy * hit], t = ((web[0] - af[0]) * dx + (web[1] - af[1]) * dy) / lf / lf
    if (t > -0.2 && t < 0.95 && (!best || t > best.webT)) best = { web, webT: t }
  }
  return best ?? { web: null, webT: null }
}
// 프레임 하나에서 다섯 손가락 모두 (폭 + 갈라지는 곳)
export const measure = (L, m: SkinMask) => Object.fromEntries(FINGERS.map((f) => [f, { ...measureFinger(L, m, f), ...findWeb(L, m, f) }])) as Record<Finger, any>
