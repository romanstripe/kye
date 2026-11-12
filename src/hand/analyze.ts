// 영상 파일 → canvas로 40장 자르기 → MediaPipe로 프레임마다 손 좌표(21점) → 데모와 같은 P/LMS 형식으로.
// 좌표는 480×854 화면 기준 px, z는 x와 같은 배율(×480). reference/data13.js 와 같은 규칙.
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import wasmLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { HandData } from '../three/stage.ts'

export const FRAME_COUNT = 40
const IW = 480
const IH = 854
const MIN_FOUND = 8 // 손이 이만큼도 안 잡히면 실패로 보고 예시 손으로

export const WASM = { wasmLoaderPath: wasmLoader, wasmBinaryPath: wasmBinary }

let landmarker: Promise<HandLandmarker> | null = null
export function getLandmarker() {
  landmarker ??= (async () => {
    const { HandLandmarker } = await import('@mediapipe/tasks-vision')
    const wasm = WASM
    const make = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: '/mediapipe/hand_landmarker.task', delegate },
        runningMode: 'IMAGE',
        numHands: 1,
      })
    try {
      return await make('GPU')
    } catch {
      return await make('CPU')
    }
  })()
  landmarker.catch(() => (landmarker = null))
  return landmarker
}

const once = (el: HTMLVideoElement, ok: string) =>
  new Promise<void>((resolve, reject) => {
    const done = () => {
      el.removeEventListener(ok, onOk)
      el.removeEventListener('error', onErr)
    }
    const onOk = () => (done(), resolve())
    const onErr = () => (done(), reject(new Error('영상을 읽지 못했어요')))
    el.addEventListener(ok, onOk)
    el.addEventListener('error', onErr)
  })

async function seek(v: HTMLVideoElement, t: number) {
  if (Math.abs(v.currentTime - t) < 1e-3) return
  const p = once(v, 'seeked')
  v.currentTime = t
  await p
}

// 13(약지 첫째 마디 시작)·14(둘째 마디 시작) → 반지 자리 [cx,cy,cz, 방향 dx,dy,dz, 손가락 반지름]
function ringPose(L: number[][]) {
  const a = L[13], b = L[14]
  const sx = b[0] - a[0], sy = b[1] - a[1], sz = b[2] - a[2]
  const n3 = Math.hypot(sx, sy, sz) || 1
  const n2 = Math.hypot(sx, sy)
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, sx / n3, sy / n3, sz / n3, 0.31 * n2]
}

// 프레임 사이 떨림을 줄이는 5점 평균 (reference/apply_meas.py 와 같은 [1,2,3,2,1])
function smooth(rows: number[][]) {
  const k = [1, 2, 3, 2, 1], n = rows.length
  return rows.map((_, i) => {
    const out = new Array(7).fill(0)
    for (let j = -2; j <= 2; j++) {
      const r = rows[Math.min(n - 1, Math.max(0, i + j))]
      for (let c = 0; c < 7; c++) out[c] += r[c] * k[j + 2]
    }
    for (let c = 0; c < 7; c++) out[c] /= 9
    const d = Math.hypot(out[3], out[4], out[5]) || 1
    for (let c = 3; c < 6; c++) out[c] /= d
    return out
  })
}

// 프레임별 손 좌표(못 찾은 곳은 null) → 앱이 쓰는 형식. 손이 거의 안 잡히면 던짐
export function buildHand(frames: string[], found: (number[][] | null)[]): HandData {
  const ok = found.flatMap((l, i) => (l ? [i] : []))
  if (ok.length < MIN_FOUND) throw new Error('손을 찾지 못했어요')
  const pmin = ok[0], pmax = ok[ok.length - 1]

  // 중간에 놓친 프레임은 바로 앞 프레임 값으로 채움
  const LMS: number[][][] = []
  for (let i = pmin; i <= pmax; i++) LMS[i] = found[i] ?? LMS[i - 1]
  const P: (number[] | null)[] = new Array(found.length).fill(null)
  smooth(LMS.slice(pmin).map(ringPose)).forEach((p, j) => (P[pmin + j] = p.map((x) => Math.round(x * 1000) / 1000)))
  return { N: found.length, P, LMS, frames, pmin, pmax, custom: true }
}

export async function analyzeVideo(file: File, onProgress: (done: number, total: number) => void): Promise<HandData> {
  const lm = await getLandmarker()
  const src = URL.createObjectURL(file)
  const frames: string[] = []
  try {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.src = src
    await once(v, 'loadeddata')
    if (v.duration === Infinity) {
      // 길이 정보가 없는 영상(웹캠 녹화 webm 등): 끝으로 한 번 보내서 길이를 알아냄
      const d = once(v, 'durationchange')
      v.currentTime = 1e7
      await d
      await seek(v, 0)
    }
    const { videoWidth: vw, videoHeight: vh, duration } = v
    if (!vw || !vh || !isFinite(duration) || duration <= 0) throw new Error('영상을 읽지 못했어요')

    const c = document.createElement('canvas')
    c.width = IW
    c.height = IH
    const ctx = c.getContext('2d')!
    const k = Math.max(IW / vw, IH / vh) // 화면을 꽉 채우도록 가운데를 잘라 맞춤
    const dw = vw * k, dh = vh * k

    const found: (number[][] | null)[] = []
    for (let i = 0; i < FRAME_COUNT; i++) {
      await seek(v, Math.min(duration - 0.05, (i / (FRAME_COUNT - 1)) * duration))
      ctx.drawImage(v, (IW - dw) / 2, (IH - dh) / 2, dw, dh)
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85))
      if (!blob) throw new Error('프레임을 만들지 못했어요')
      frames.push(URL.createObjectURL(blob))
      const l = lm.detect(c).landmarks[0]
      found.push(l ? l.map((p) => [p.x * IW, p.y * IH, p.z * IW]) : null)
      onProgress(i + 1, FRAME_COUNT)
      await new Promise((r) => setTimeout(r)) // 진행 표시가 갱신되게 한 번 쉼
    }

    return buildHand(frames, found)
  } catch (e) {
    frames.forEach((u) => URL.revokeObjectURL(u))
    throw e
  } finally {
    URL.revokeObjectURL(src)
  }
}

export const revokeHand = (h: HandData) => h.frames.forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u))
