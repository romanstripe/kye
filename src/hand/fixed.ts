import { FINGERS, JOINT, median } from './width.ts'

// 손가락별 고정값: 폭(px)·잰 프레임들의 관절 길이(px)·잰 프레임 수·옆 어긋남·갈라지는 곳 위치(관절 길이 대비, 없으면 null)
// T = 갈림 비율(MCP→PIP 위, 0=MCP 1=PIP)의 고정값, Tsrc = 어디서 왔는지: 측정(잘 잡힌 프레임들의 가운데값) / 이웃(못 잡아서 이웃 손가락 평균) / 기본(이웃도 없음)
export type TSrc = '측정' | '이웃' | '기본'
export type Fixed = Record<string, { W: number; L: number; n: number; O: number; T: number | null; Tsrc: TSrc }>

// 이웃 손가락 (갈림 비율을 빌려 올 때: 엄지는 검지만, 나머지는 옆 손가락. 엄지는 위치가 달라서 이웃으로 치지 않음)
const ADJ: Record<string, string[]> = { thumb: ['index'], index: ['middle'], middle: ['index', 'ring'], ring: ['middle', 'pinky'], pinky: ['ring'] }

// 재생 구간(pmin~pmax)을 다 재고 나면, 손가락마다 양쪽 경계가 다 잡힌 프레임들의 폭 가운데값을 하나로 고정. 아직 다 못 쟀으면 null
// meas = 프레임 주소 → 그 프레임의 손가락별 측정(measure), jlen(f, i) = 프레임 i 에서 손가락 f 의 관절 길이(px)
export function computeFixed(meas: Map<string, any>, frames: string[], LMS: number[][][], jlen: (f: string, i: number) => number, pmin: number, pmax: number): Fixed | null {
  for (let i = pmin; i <= pmax; i++) if (!meas.get(frames[i])) return null
  const rows = Object.fromEntries(
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
  // 한 번도 못 잡은 손가락은 이웃 손가락들의 고정 비율 평균을 씀 (이웃도 없으면 기본값 → 반지 자리 계산에서 0.6)
  return Object.fromEntries(
    FINGERS.map((f) => {
      const r = rows[f]
      if (r.T != null) return [f, { ...r, Tsrc: '측정' as TSrc }]
      const nb = ADJ[f].map((g) => rows[g].T).filter((x): x is number => x != null)
      return [f, nb.length ? { ...r, T: nb.reduce((a, b) => a + b, 0) / nb.length, Tsrc: '이웃' as TSrc } : { ...r, Tsrc: '기본' as TSrc }]
    }),
  )
}
