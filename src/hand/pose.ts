import { JOINT } from './width.ts'
import type { Finger } from './width.ts'
import type { Fixed } from './fixed.ts'

// 손가락 f 의 반지 자리 [cx,cy,cz, 축 x,y,z, 반지 안쪽 반지름(px)]. 폭을 아직 못 쟀으면 null (순수 계산)
//  - L = 이 프레임의 손 점(5프레임 평균), fx = 그 손가락의 고정값, ringWmm = 그 손가락 첫 반지의 폭(mm), FD = 반지 안쪽 지름(mm)
//  - 축 = 화면에서의 손가락 방향(시작 관절→다음 관절). 앞뒤 기울기는 없음(z=0)
//  - 크기 = 그 손가락 고정 폭 × (이 프레임 관절 길이 ÷ 잰 프레임들 관절 길이)
//  - 중심 = 시작 관절→다음 관절 위의 자리 r (0~1): 갈라지는 곳 + (반지 폭/2 + 1.5mm) 위, 갈라지는 곳을 못 찾았으면 0.6 (mm는 지금 잰 px/mm = 2·fr/FD)
export function ringPoseOf(f: string, L: number[][], fx: Fixed[string] | undefined, ringWmm: number, FD: number): number[] | null {
  const [ia, ib] = JOINT[f as Finger], a = L[ia], b = L[ib]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (!(fx && fx.n && len > 0)) return null
  const jd = len || 1, sh = fx.O * len // 피부 가운데로 옆 이동 (축에 수직)
  const fr = (fx.W * len) / fx.L / 2
  const r = fx.T != null ? Math.min(1.15, (fx.T * len + ((ringWmm / 2 + 1.5) * 2 * fr) / FD) / len) : 0.6
  return [
    a[0] + (b[0] - a[0]) * r - ((b[1] - a[1]) / jd) * sh,
    a[1] + (b[1] - a[1]) * r + ((b[0] - a[0]) / jd) * sh,
    a[2] + (b[2] - a[2]) * r,
    (b[0] - a[0]) / jd,
    (b[1] - a[1]) / jd,
    0,
    fr,
  ]
}
