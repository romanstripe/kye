import { JOINT } from './width.ts'
import type { Finger } from './width.ts'
import type { Fixed } from './fixed.ts'

// 손가락 f 의 반지 자리 [cx,cy,cz, 축 x,y,z, 반지 안쪽 반지름(px)]. 폭을 아직 못 쟀으면 null (순수 계산)
//  - L = 이 프레임의 손 점(5프레임 평균), fx = 그 손가락의 고정값, ringWmm = 그 손가락 첫 반지의 폭(mm), FD = 반지 안쪽 지름(mm)
//  - 축 = 화면에서의 손가락 방향(시작 관절→다음 관절). 앞뒤 기울기는 없음(z=0)
//  - 크기 = 그 손가락 고정 폭 × (이 프레임 관절 길이 ÷ 잰 프레임들 관절 길이)
//  - 갈림 비율 T: 이 프레임에서 잘 잡혔고 고정값과 크게 다르지 않으면 측정값, 아니면 고정값 (고정값은 hand/fixed.ts: 가운데값 → 이웃 평균)
//  - 중심 = 시작 관절→다음 관절 위의 자리 r (0~1): 갈라지는 곳 + (반지 폭/2 + 1.5mm) 위, 비율이 아예 없으면 0.6 (mm는 지금 잰 px/mm = 2·fr/FD)
// 이 프레임에서 잰 갈림 비율(measuredT)이 고정값에서 이만큼(관절 길이 대비) 넘게 벗어나면 이상한 프레임으로 보고 고정값을 씀
const TOL = 0.12

export type Pose = (number | string)[]   // [cx,cy,cz, 축 x,y,z, 반지름, 쓴 갈림 비율(없으면 -1), 출처(측정/고정/이웃/기본)]
export function ringPoseOf(f: string, L: number[][], fx: Fixed[string] | undefined, ringWmm: number, FD: number, measuredT: number | null = null): Pose | null {
  const [ia, ib] = JOINT[f as Finger], a = L[ia], b = L[ib]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (!(fx && fx.n && len > 0)) return null
  const jd = len || 1, sh = fx.O * len // 피부 가운데로 옆 이동 (축에 수직)
  const fr = (fx.W * len) / fx.L / 2
  const useM = measuredT != null && fx.T != null && Math.abs(measuredT - fx.T) <= TOL
  const T = useM ? measuredT : fx.T
  const r = T != null ? Math.min(1.15, (T * len + ((ringWmm / 2 + 1.5) * 2 * fr) / FD) / len) : 0.6
  return [
    a[0] + (b[0] - a[0]) * r - ((b[1] - a[1]) / jd) * sh,
    a[1] + (b[1] - a[1]) * r + ((b[0] - a[0]) / jd) * sh,
    a[2] + (b[2] - a[2]) * r,
    (b[0] - a[0]) / jd,
    (b[1] - a[1]) / jd,
    0,
    fr,
    T ?? -1,
    useM ? '측정' : fx.Tsrc === '측정' ? '고정' : fx.Tsrc,
  ]
}
