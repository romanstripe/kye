import { FINGERS, JOINT, median } from './width.ts'

// 손가락별 고정값: 폭(px)·잰 프레임들의 관절 길이(px)·잰 프레임 수·옆 어긋남·갈라지는 곳 위치(관절 길이 대비, 없으면 null)
export type Fixed = Record<string, { W: number; L: number; n: number; O: number; T: number | null }>

// 재생 구간(pmin~pmax)을 다 재고 나면, 손가락마다 양쪽 경계가 다 잡힌 프레임들의 폭 가운데값을 하나로 고정. 아직 다 못 쟀으면 null
// meas = 프레임 주소 → 그 프레임의 손가락별 측정(measure), jlen(f, i) = 프레임 i 에서 손가락 f 의 관절 길이(px)
export function computeFixed(meas: Map<string, any>, frames: string[], LMS: number[][][], jlen: (f: string, i: number) => number, pmin: number, pmax: number): Fixed | null {
  for (let i = pmin; i <= pmax; i++) if (!meas.get(frames[i])) return null
  return Object.fromEntries(
    FINGERS.map((f) => {
      const ws: number[] = [], ls: number[] = [], os: number[] = [], ts: number[] = []
      const [ja, jb] = JOINT[f]
      for (let i = pmin; i <= pmax; i++) {
        const q = meas.get(frames[i])[f]
        if (q.webT != null) ts.push(q.webT)
        if (q.w == null) continue
        ws.push(q.w)
        ls.push(jlen(f, i))
        // 잰 피부 경계의 가운데가 관절 축에서 옆으로 얼마나 벗어났는지 (관절 길이 대비, 축에 수직 방향 기준)
        const L = LMS[i]
        if (!L) continue
        const dx = L[jb][0] - L[ja][0], dy = L[jb][1] - L[ja][1], d = Math.hypot(dx, dy) || 1
        os.push((((q.A[0] + q.B[0]) / 2 - q.c[0]) * -dy + ((q.A[1] + q.B[1]) / 2 - q.c[1]) * dx) / d / d)
      }
      const T = ts.length >= 3 ? median(ts) : null // 갈라지는 곳이 3프레임 이상에서 잡혀야 믿음
      return [f, ws.length ? { W: median(ws), L: median(ls), n: ws.length, O: os.length ? median(os) : 0, T } : { W: 0, L: 1, n: 0, O: 0, T }]
    }),
  )
}
