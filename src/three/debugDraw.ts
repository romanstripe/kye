// @ts-nocheck
import { IW, TAU } from './shared.ts'
import type { SkinMask } from '../hand/skin.ts'

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]]
export function drawHandDebug(cv2: HTMLCanvasElement, L: number[][], mk: SkinMask | undefined, r: any) {
  const x = cv2.getContext('2d'), k = cv2.width / IW; x.clearRect(0, 0, cv2.width, cv2.height)
  if (mk) x.drawImage(mk.overlay, 0, 0, cv2.width, cv2.height)
  x.lineCap = 'round'
  x.strokeStyle = '#39d98a'; x.lineWidth = 2 * k
  BONES.forEach(([a, b]) => { if ((a === 13 && b === 14)) return; x.beginPath(); x.moveTo(L[a][0] * k, L[a][1] * k); x.lineTo(L[b][0] * k, L[b][1] * k); x.stroke() })
  x.strokeStyle = '#ff2d2d'; x.lineWidth = 4 * k; x.beginPath(); x.moveTo(L[13][0] * k, L[13][1] * k); x.lineTo(L[14][0] * k, L[14][1] * k); x.stroke()
  if (!mk) r = null
  if (r) { // 폭 재기: 소지선~중지선 사이 수직선(노랑) + 경계 두 점(초록) + 폭 숫자
    x.strokeStyle = '#ffd25a'; x.lineWidth = 2 * k; x.beginPath(); x.moveTo((r.c[0] - r.n[0] * r.limP) * k, (r.c[1] - r.n[1] * r.limP) * k); x.lineTo((r.c[0] + r.n[0] * r.limM) * k, (r.c[1] + r.n[1] * r.limM) * k); x.stroke()
    if (r.w != null) {
      ;[r.A, r.B].forEach(p => { x.beginPath(); x.arc(p[0] * k, p[1] * k, 6 * k, 0, TAU); x.fillStyle = '#19d96b'; x.fill(); x.lineWidth = 2 * k; x.strokeStyle = '#fff'; x.stroke() })
    }
    const txt = r.w == null ? '제외' : `${r.w.toFixed(1)}px`
    x.font = `700 ${15 * k}px sans-serif`; x.lineWidth = 4 * k; x.strokeStyle = 'rgba(0,0,0,.75)'; x.fillStyle = '#fff'
    x.strokeText(txt, (r.c[0] + 10) * k, (r.c[1] - 10) * k); x.fillText(txt, (r.c[0] + 10) * k, (r.c[1] - 10) * k)
  }
  L.forEach((p, i) => { const big = i === 13 || i === 14; x.beginPath(); x.arc(p[0] * k, p[1] * k, (big ? 7 : 3) * k, 0, TAU); x.fillStyle = big ? '#ff2d2d' : '#ffffff'; x.fill(); x.lineWidth = 1.2 * k; x.strokeStyle = big ? '#fff' : '#39d98a'; x.stroke() })
}


