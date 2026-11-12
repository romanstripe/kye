// @ts-nocheck  (약지 폭 재기: 순수 계산, 화면·three 와 무관)
import type { SkinMask } from './skin.ts'

const IW = 480, IH = 854   // 프레임 좌표계 (분석 때 맞춘 크기)

export const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
// 13→14 가운데에서 손가락에 수직으로 소지선(17→18)·중지선(9→10)까지 걸어가며 양쪽 경계를 찾음.
// 경계 = 구간 안에서 마스크가 끝나는 곳, 마스크가 끝까지 이어지면(손가락이 붙음) 밝기가 가장 어두운 곳(손가락 사이 틈)
export function measure(L, m: SkinMask) {
  const a = L[13], b = L[14], c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, u = [dx / len, dy / len]
  let n = [-u[1], u[0]]
  if ((L[9][0] - c[0]) * n[0] + (L[9][1] - c[1]) * n[1] < 0) n = [-n[0], -n[1]]   // +n = 중지 쪽, -n = 소지 쪽
  const hit = (P, Q) => { const d = [Q[0] - P[0], Q[1] - P[1]], den = n[0] * d[1] - n[1] * d[0]; return Math.abs(den) < 1e-6 ? null : ((P[0] - c[0]) * d[1] - (P[1] - c[1]) * d[0]) / den }
  const sM = hit(L[9], L[10]), sP = hit(L[17], L[18])
  if (sM == null || sP == null || sM <= 2 || sP >= -2) return { c, n, w: null, limM: 60, limP: 60 }
  const limM = sM, limP = -sP, fail = { c, n, w: null, limM, limP }
  const skin = (x, y) => { const ix = Math.floor(x * m.w / IW), iy = Math.floor(y * m.h / IH); return ix >= 0 && iy >= 0 && ix < m.w && iy < m.h && m.data[iy * m.w + ix] === 1 }
  const lumaAt = (x, y) => { let t = 0; for (const o of [-2, 0, 2]) { const ix = Math.round((x + u[0] * o) * m.lw / IW), iy = Math.round((y + u[1] * o) * m.lh / IH); t += ix >= 0 && iy >= 0 && ix < m.lw && iy < m.lh ? m.luma[iy * m.lw + ix] : 255 } return t / 3 }
  if (!skin(c[0], c[1])) return fail
  const side = (sg, lim) => {
    let s = 0; while (s < lim && skin(c[0] + n[0] * sg * (s + 0.25), c[1] + n[1] * sg * (s + 0.25))) s += 0.25
    if (s < lim - 0.25) return { s, kind: '마스크' }
    const prof = []; for (let t = 0.3 * lim; t <= 0.85 * lim; t += 0.5) prof.push([t, lumaAt(c[0] + n[0] * sg * t, c[1] + n[1] * sg * t)])
    if (prof.length < 5) return null
    const sm = prof.map((_, i) => { let q = 0, k = 0; for (let j = -2; j <= 2; j++) { const e = prof[i + j]; if (e) { q += e[1]; k++ } } return q / k })
    let bi = 0; sm.forEach((v, i) => { if (v < sm[bi]) bi = i })
    if (sm[bi] > 0.85 * median(sm)) return null   // 뚜렷하게 어두운 곳이 없으면 못 잡은 것
    return { s: prof[bi][0], kind: '어두움' }
  }
  const rM = side(1, limM), rP = side(-1, limP)
  if (!rM || !rP) return fail
  return { c, n, limM, limP, w: rM.s + rP.s, A: [c[0] - n[0] * rP.s, c[1] - n[1] * rP.s], B: [c[0] + n[0] * rM.s, c[1] + n[1] * rM.s], kindM: rM.kind, kindP: rP.kind }
}

