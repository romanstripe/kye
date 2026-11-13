// 영상 파일 → canvas로 40장 자르기 → MediaPipe로 프레임마다 손 좌표(21점) → 데모와 같은 P/LMS 형식으로.
// 좌표는 480×854 화면 기준 px, z는 x와 같은 배율(×480). 원본 데모 와 같은 규칙.
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import wasmLoader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { HandData } from '../three/stage.ts'

export const FRAME_COUNT = 40
const IW = 480
const IH = 854
const SS = 2 // 사진은 2배 크기(960×1708)로 저장해서 선명하게. 좌표는 0~1 비율이라 그대로 IW×IH 기준
const MIN_FOUND = 8 // 손이 이만큼도 안 잡히면 실패로 보고 예시 손으로

export const WASM = { wasmLoaderPath: wasmLoader, wasmBinaryPath: wasmBinary }

let landmarker: Promise<HandLandmarker> | null = null
function getLandmarker() {
  landmarker ??= (async () => {
    const { HandLandmarker } = await import('@mediapipe/tasks-vision')
    const wasm = WASM
    // GPU 모드는 휴대폰 브라우저에서 멈추기도 해서 CPU만 씀 (프레임 40장이라 충분히 빠름)
    return HandLandmarker.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: '/mediapipe/hand_landmarker.task', delegate: 'CPU' },
      runningMode: 'IMAGE',
      numHands: 1,
    })
  })()
  landmarker.catch(() => (landmarker = null))
  return landmarker
}

const timeout = <T,>(p: Promise<T>, ms: number, msg: string) =>
  new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error(msg)), ms)
    p.then((v) => (clearTimeout(t), res(v)), (e) => (clearTimeout(t), rej(e)))
  })

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
  await timeout(p, 5000, '영상 프레임을 못 가져왔어요')
}

// 13(약지 첫째 마디 시작)·14(둘째 마디 시작) → 반지 자리 [cx,cy,cz, 방향 dx,dy,dz, 손가락 반지름]
function ringPose(L: number[][]) {
  const a = L[13], b = L[14]
  const sx = b[0] - a[0], sy = b[1] - a[1], sz = b[2] - a[2]
  const n3 = Math.hypot(sx, sy, sz) || 1
  const n2 = Math.hypot(sx, sy)
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, sx / n3, sy / n3, sz / n3, 0.31 * n2]
}

// 프레임 사이 떨림을 줄이는 5점 평균 (원본 데모 와 같은 [1,2,3,2,1])
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
function buildHand(frames: string[], found: (number[][] | null)[]): HandData {
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

export async function analyzeVideo(file: File, onProgress: (done: number, total: number, stage?: string) => void): Promise<HandData> {
  onProgress(0, FRAME_COUNT, '손 인식 모델 불러오는 중')
  const lm = await timeout(getLandmarker(), 40000, '손 인식 모델을 불러오지 못했어요')
  const src = URL.createObjectURL(file)
  const frames: string[] = []
  let cleanup = () => {}
  try {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.src = src
    // 사파리는 화면에 붙이지 않은 영상을 안 읽는 경우가 있어 숨겨서 붙임
    // 1px로 두면 사파리가 화질을 낮춰 디코딩할 수 있어, 실제 크기로 두되 뒤에 숨김
    v.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:854px;opacity:0.01;z-index:-1;pointer-events:none'
    document.body.appendChild(v)
    cleanup = () => v.remove()
    onProgress(0, FRAME_COUNT, '영상 읽는 중')
    const loaded = once(v, 'loadeddata')
    v.load()
    // 아이폰 사파리는 재생을 시작해야 첫 화면을 읽어 주는 일이 있어 잠깐 재생
    v.play().then(() => v.pause()).catch(() => {})
    await timeout(loaded, 15000, '영상을 읽지 못했어요 (사파리)')
    v.pause()
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
    c.width = IW * SS
    c.height = IH * SS
    const ctx = c.getContext('2d')!
    // 손 찾기는 작은 캔버스로 (큰 사진을 매번 넘기면 폰에서 메모리가 많이 듦)
    const dc = document.createElement('canvas')
    dc.width = IW
    dc.height = IH
    const dctx = dc.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    const k = Math.max((IW * SS) / vw, (IH * SS) / vh) // 화면을 꽉 채우도록 가운데를 잘라 맞춤
    const dw = vw * k, dh = vh * k

    onProgress(0, FRAME_COUNT, `첫 프레임 분석 중 (영상 ${vw}×${vh})`)
    const found: (number[][] | null)[] = []
    for (let i = 0; i < FRAME_COUNT; i++) {
      await seek(v, Math.min(duration - 0.05, (i / (FRAME_COUNT - 1)) * duration))
      ctx.drawImage(v, (IW * SS - dw) / 2, (IH * SS - dh) / 2, dw, dh)
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92))
      if (!blob) throw new Error('프레임을 만들지 못했어요')
      frames.push(URL.createObjectURL(blob))
      dctx.drawImage(c, 0, 0, IW, IH)
      const l = lm.detect(dc).landmarks[0]
      found.push(l ? l.map((p) => [p.x * IW, p.y * IH, p.z * IW]) : null)
      onProgress(i + 1, FRAME_COUNT)
      await new Promise((r) => setTimeout(r)) // 진행 표시가 갱신되게 한 번 쉼
    }

    c.width = c.height = dc.width = dc.height = 0   // 캔버스 메모리 바로 반납
    return buildHand(frames, found)
  } catch (e) {
    frames.forEach((u) => URL.revokeObjectURL(u))
    throw e
  } finally {
    cleanup()
    URL.revokeObjectURL(src)
  }
}

// ── 실시간 카메라용 ──
// 모델을 미리 불러 둠 (촬영하는 3초 동안 로딩)
export const warmup = () => { getLandmarker().catch(() => {}) }

export const newFrameCanvas = () => {
  const c = document.createElement('canvas')
  c.width = IW * SS
  c.height = IH * SS
  return c
}

// 영상 분석과 같은 규칙: 화면을 꽉 채우도록 가운데를 잘라 맞춤
export function drawCover(c: HTMLCanvasElement, src: CanvasImageSource, sw: number, sh: number) {
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const k = Math.max(c.width / sw, c.height / sh)
  const dw = sw * k, dh = sh * k
  ctx.drawImage(src, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh)
}

// 이미 찍어 둔 프레임(JPEG 40장) → 손 좌표 → HandData. analyzeVideo의 두 번째 절반과 같음
export async function analyzeFrames(blobs: Blob[], onProgress: (done: number, total: number, stage?: string) => void): Promise<HandData> {
  onProgress(0, blobs.length, '손 인식 모델 불러오는 중')
  const lm = await timeout(getLandmarker(), 40000, '손 인식 모델을 불러오지 못했어요')
  const frames: string[] = []
  try {
    const dc = document.createElement('canvas')
    dc.width = IW
    dc.height = IH
    const dctx = dc.getContext('2d')!
    const found: (number[][] | null)[] = []
    for (let i = 0; i < blobs.length; i++) {
      frames.push(URL.createObjectURL(blobs[i]))
      const bmp = await createImageBitmap(blobs[i])
      dctx.drawImage(bmp, 0, 0, IW, IH)
      bmp.close()
      const l = lm.detect(dc).landmarks[0]
      found.push(l ? l.map((p) => [p.x * IW, p.y * IH, p.z * IW]) : null)
      onProgress(i + 1, blobs.length)
      await new Promise((r) => setTimeout(r))
    }
    dc.width = dc.height = 0
    return buildHand(frames, found)
  } catch (e) {
    frames.forEach((u) => URL.revokeObjectURL(u))
    throw e
  }
}

export const revokeHand = (h: HandData) => h.frames.forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u))
