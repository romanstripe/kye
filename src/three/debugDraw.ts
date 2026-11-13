// @ts-nocheck
import { IW, TAU } from './shared.ts'
import { FINGERS } from '../hand/width.ts'
import type { SkinMask } from '../hand/skin.ts'

const FINGER_COLOR = { thumb: '#ff8a3d', index: '#4fc3f7', middle: '#b388ff', ring: '#ffd25a', pinky: '#ff6fae' }   // 손가락별 선 색
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]]
export function drawHandDebug(cv2: HTMLCanvasElement, L: number[][], mk: SkinMask | undefined, r: any, poses?: Record<string, number[] | null>) {
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
    if (q.web) { x.save(); x.translate(q.web[0] * k, q.web[1] * k); x.rotate(Math.PI / 4); x.fillStyle = col; x.fillRect(-5 * k, -5 * k, 10 * k, 10 * k); x.lineWidth = 2 * k; x.strokeStyle = '#fff'; x.strokeRect(-5 * k, -5 * k, 10 * k, 10 * k); x.restore() }   // 갈라지는 곳: 마름모
    const txt = q.w == null ? `제외 · ${q.why ?? ''}` : `${q.w.toFixed(1)}`
    x.font = `700 ${13 * k}px sans-serif`; x.lineWidth = 4 * k; x.strokeStyle = 'rgba(0,0,0,.75)'; x.fillStyle = col
    x.strokeText(txt, (q.c[0] + 8) * k, (q.c[1] - 8) * k); x.fillText(txt, (q.c[0] + 8) * k, (q.c[1] - 8) * k)
  })
  if (poses) FINGERS.forEach((f) => { // 반지 방향: 반지가 따르는 손가락 벡터(시작 관절→다음 관절, 화면 좌표)를 화살표로, 반지 평면(벡터에 직각)을 가로선으로
    const p = poses[f]; if (!p) return
    const col = FINGER_COLOR[f], d = Math.hypot(p[3], p[4]) || 1, ux = p[3] / d, uy = p[4] / d, R = p[6]
    const X = p[0], Y = p[1], ex = X + ux * 46, ey = Y + uy * 46
    const line = (x1, y1, x2, y2) => { x.beginPath(); x.moveTo(x1 * k, y1 * k); x.lineTo(x2 * k, y2 * k); x.stroke() }
    const head = (s) => { const a = Math.atan2(uy, ux); line(ex, ey, ex - 11 * Math.cos(a - s), ey - 11 * Math.sin(a - s)); line(ex, ey, ex - 11 * Math.cos(a + s), ey - 11 * Math.sin(a + s)) }
    ;[['#fff', 5.5], [col, 3]].forEach(([c, w]) => { x.strokeStyle = c; x.lineWidth = w * k; line(X - uy * R, Y + ux * R, X + uy * R, Y - ux * R); line(X, Y, ex, ey); head(0.5) })
    const pt = `${p[7] >= 0 ? '+' : ''}${p[7].toFixed(0)}°`   // pitch: + 손끝이 카메라 쪽, - 멀어짐
    x.font = `700 ${13 * k}px sans-serif`; x.lineWidth = 4 * k; x.strokeStyle = 'rgba(0,0,0,.75)'; x.fillStyle = col
    x.strokeText(pt, (ex + 6) * k, (ey + 4) * k); x.fillText(pt, (ex + 6) * k, (ey + 4) * k)
  })
  L.forEach((p, i) => { const big = i === 13 || i === 14; x.beginPath(); x.arc(p[0] * k, p[1] * k, (big ? 7 : 3) * k, 0, TAU); x.fillStyle = big ? '#ff2d2d' : '#ffffff'; x.fill(); x.lineWidth = 1.2 * k; x.strokeStyle = big ? '#fff' : '#39d98a'; x.stroke() })
}


