import { FINGERS, FINGER_NAME, median } from './width.ts'

// 디버그 글자 만들기 (재생 구간 pmin~pmax 의 측정 meas 를 읽기만 함)

// 손가락별: 양쪽 경계가 잡힌 프레임들의 폭 가운데값(잰 프레임 수)
export function fingerLine(meas: Map<string, any>, frames: string[], pmin: number, pmax: number) {
  return FINGERS.map((f) => {
    const ws: number[] = []
    for (let i = pmin; i <= pmax; i++) {
      const q = meas.get(frames[i])?.[f]
      if (q?.w != null) ws.push(q.w)
    }
    return `${FINGER_NAME[f]} ${ws.length ? median(ws).toFixed(1) : '-'}(${ws.length})`
  }).join(' · ')
}

// 손가락별 갈림 비율(0=MCP, 1=PIP)과 이 프레임에서 쓴 값의 출처: 측정(이 프레임에서 잰 값) / 고정(가운데값) / 이웃(이웃 평균) / 기본(0.6)
export function ratioLine(poses: Record<string, (number | string)[] | null>) {
  return '\n갈림 ' + FINGERS.map((f) => { const p = poses[f]; return p ? `${FINGER_NAME[f]} ${(p[7] as number) >= 0 ? (p[7] as number).toFixed(2) : '-'}(${p[8]})` : `${FINGER_NAME[f]} -` }).join(' · ')
}

// 약지·소지가 제외된 프레임의 이유별 개수
export function whyLine(meas: Map<string, any>, frames: string[], pmin: number, pmax: number) {
  return (['ring', 'pinky'] as const)
    .map((f) => {
      const t: Record<string, number> = {}
      let n = 0
      for (let i = pmin; i <= pmax; i++) {
        const q = meas.get(frames[i])?.[f]
        if (q && q.w == null) {
          n++
          t[q.why ?? '?'] = (t[q.why ?? '?'] || 0) + 1
        }
      }
      return n ? `\n${FINGER_NAME[f]} 제외 ${n}: ${Object.entries(t).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''
    })
    .join('')
}
