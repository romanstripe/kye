// 디버그용 피부 마스크: MediaPipe ImageSegmenter(selfie_multiclass_256x256)로 프레임마다 피부 영역을 구함.
// 클래스: 0 배경, 1 머리카락, 2 몸 피부, 3 얼굴 피부, 4 옷, 5 기타 → 2·3을 피부로 봄
import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import { WASM } from './analyze.ts'

export type SkinMask = {
  w: number
  h: number
  data: Uint8Array // 1 = 피부
  overlay: HTMLCanvasElement // 반투명 빨강 (마스크 해상도)
  lw: number
  lh: number
  luma: Uint8Array // 프레임 밝기 (lw×lh), 손가락 사이 틈 찾기용
}

let segmenter: Promise<ImageSegmenter> | null = null
function getSegmenter() {
  segmenter ??= (async () => {
    const { ImageSegmenter } = await import('@mediapipe/tasks-vision')
    return ImageSegmenter.createFromOptions(WASM, {
      baseOptions: { modelAssetPath: '/mediapipe/selfie_multiclass_256x256.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    })
  })()
  segmenter.catch(() => (segmenter = null))
  return segmenter
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('프레임을 읽지 못했어요'))
    im.src = url
  })

export async function skinMask(frameUrl: string): Promise<SkinMask> {
  const [seg, im] = await Promise.all([getSegmenter(), loadImage(frameUrl)])
  const res = seg.segment(im)
  try {
    const m = res.categoryMask
    if (!m) throw new Error('마스크가 없어요')
    const cat = m.getAsUint8Array()
    const w = m.width, h = m.height
    const data = new Uint8Array(w * h)
    const overlay = document.createElement('canvas')
    overlay.width = w
    overlay.height = h
    const ctx = overlay.getContext('2d')!
    const px = ctx.createImageData(w, h)
    for (let i = 0; i < data.length; i++) {
      if (cat[i] === 2 || cat[i] === 3) {
        data[i] = 1
        px.data[i * 4] = 255
        px.data[i * 4 + 1] = 30
        px.data[i * 4 + 2] = 30
        px.data[i * 4 + 3] = 105
      }
    }
    ctx.putImageData(px, 0, 0)
    const lc = document.createElement('canvas')
    lc.width = im.naturalWidth
    lc.height = im.naturalHeight
    const lx = lc.getContext('2d', { willReadFrequently: true })!
    lx.drawImage(im, 0, 0)
    const rgba = lx.getImageData(0, 0, lc.width, lc.height).data
    const luma = new Uint8Array(lc.width * lc.height)
    for (let i = 0; i < luma.length; i++) luma[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
    return { w, h, data, overlay, lw: lc.width, lh: lc.height, luma }
  } finally {
    res.close()
  }
}
