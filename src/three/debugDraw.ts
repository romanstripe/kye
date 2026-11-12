// @ts-nocheck
import { IW, TAU } from './shared.ts'
import { FINGERS } from '../hand/width.ts'
import type { SkinMask } from '../hand/skin.ts'

export const FINGER_COLOR = { thumb: '#ff8a3d', index: '#4fc3f7', middle: '#b388ff', ring: '#ffd25a', pinky: '#ff6fae' }   // 손가락별 선 색
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]]
export function drawHandDebug(cv2: HTMLCanvasElement, L: number[][], mk: SkinMask | undefined, r: any) {
  const x = cv2.getContext('2d'), k = cv2.width / IW; x.clearRect(0, 0, cv2.width, cv2.height)
  if (mk) x.drawImage(mk.overlay, 0, 0, cv2.width, cv2.height)
  x.lineCap = 'round'
  x.strokeStyle = '#39d98a'; x.lineWidth = 2 * k
  BONES.forEach(([a, b]) => { if ((a === 13 && b === 14)) return; x.beginPath(); x.moveTo(L[a][0] * k, L[a][1] * k); x.lineTo(L[b][0] * k, L[b][1] * k); x.stroke() })
  x.strokeStyle = '#ff2d2d'; x.lineWidth = 4 * k; x.beginPath(); x.moveTo(L[13][0] * k, L[13][1] * k); x.lineTo(L[14][0] * k, L[14][1] * k); x.stroke()
  if (mk && r) FINGERS.forEach((f) => { // 폭 재기: 손가락마다 다른 색 선(이웃 선까지) + 경계 두 점 + 폭 숫자
    const q = r[f]; if (!q) return; const col = FINGER_COLOR[f]
    x.strokeStyle = col; x.lineWidth = 2 * k; x.beginPath(); x.moveTo((q.c[0] - q.n[0] * q.limP) * k, (q.c[1] - q.n[1] * q.limP) * k); x.lineTo((q.c[0] + q.n[0] * q.limM) * k, (q.c[1] + q.n[1] * q.limM) * k); x.stroke()
    if (q.w != null) [q.A, q.B].forEach(p => { x.beginPath(); x.arc(p[0] * k, p[1] * k, 5 * k, 0, TAU); x.fillStyle = col; x.fill(); x.lineWidth = 2 * k; x.strokeStyle = '#fff'; x.stroke() })
    const txt = q.w == null ? '제외' : `${q.w.toFixed(1)}`
    x.font = `700 ${13 * k}px sans-serif`; x.lineWidth = 4 * k; x.strokeStyle = 'rgba(0,0,0,.75)'; x.fillStyle = col
    x.strokeText(txt, (q.c[0] + 8) * k, (q.c[1] - 8) * k); x.fillText(txt, (q.c[0] + 8) * k, (q.c[1] - 8) * k)
  })
  L.forEach((p, i) => { const big = i === 13 || i === 14; x.beginPath(); x.arc(p[0] * k, p[1] * k, (big ? 7 : 3) * k, 0, TAU); x.fillStyle = big ? '#ff2d2d' : '#ffffff'; x.fill(); x.lineWidth = 1.2 * k; x.strokeStyle = big ? '#fff' : '#39d98a'; x.stroke() })
}


