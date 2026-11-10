import { useEffect, useRef, useState } from 'react'
import { createStage } from './three/stage.ts'
import type { RingInfo, HandData } from './three/stage.ts'
import { analyzeVideo, revokeHand, FRAME_COUNT } from './hand/analyze.ts'

export type Menu = { rings: RingInfo[]; thumbs: Record<string, string>; pick: (id: string) => void; initial: string }

const IW = 480
const IH = 854

// 손 사진 + 그 위에 3D 반지(그림자 캔버스, 반지 캔버스). 데이터는 public/rings.json, public/demo/hand.json
// 내 영상을 올리면 그 손으로, 실패하거나 안 올리면 예시 손으로 보여줌
export default function HandStage({ onReady }: { onReady: (m: Menu) => void }) {
  const img = useRef<HTMLImageElement>(null)
  const tint = useRef<HTMLDivElement>(null)
  const shadow = useRef<HTMLCanvasElement>(null)
  const out = useRef<HTMLCanvasElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const stageRef = useRef<ReturnType<typeof createStage> | null>(null)
  const demo = useRef<HandData | null>(null)
  const mine = useRef<HandData | null>(null)
  const [busy, setBusy] = useState<number | null>(null) // 처리한 프레임 수
  const [custom, setCustom] = useState(false)
  const [msg, setMsg] = useState('')
  const ready = useRef(onReady)
  ready.current = onReady

  useEffect(() => {
    let stage: ReturnType<typeof createStage> | null = null
    let dead = false
    Promise.all([
      fetch('/rings.json').then((r) => r.json() as Promise<RingInfo[]>),
      fetch('/demo/hand.json').then((r) => r.json()),
    ]).then(([rings, raw]) => {
      if (dead) return
      const hand: HandData = {
        ...raw,
        frames: Array.from({ length: raw.N }, (_, i) => `/demo/${String(i).padStart(2, '0')}.jpg`),
      }
      demo.current = hand
      stage = stageRef.current = createStage(
        { img: img.current!, tint: tint.current!, shadow: shadow.current!, out: out.current! },
        rings,
        hand,
      )
      const id = new URLSearchParams(location.search).get('ring') // 확인용: ?ring=SP
      if (id) stage.pick(id)
      ready.current({ rings, thumbs: stage.thumbs, pick: stage.pick, initial: id ?? rings[0].id })
    })
    return () => {
      dead = true
      stage?.stop()
      stageRef.current = null
      if (mine.current) revokeHand(mine.current)
    }
  }, [])

  const useDemo = () => {
    if (demo.current) stageRef.current?.setHand(demo.current)
    if (mine.current) revokeHand(mine.current)
    mine.current = null
    setCustom(false)
  }

  const onFile = async (f: File | undefined) => {
    if (!f || !stageRef.current) return
    setMsg('')
    setBusy(0)
    try {
      const hand = await analyzeVideo(f, (n) => setBusy(n))
      const old = mine.current
      mine.current = hand
      stageRef.current?.setHand(hand)
      if (old) revokeHand(old)
      setCustom(true)
    } catch (e) {
      // 손을 못 찾거나 영상이 이상하면 예시 손 그대로
      setMsg(`${e instanceof Error ? e.message : '분석에 실패했어요'}. 예시 손으로 보여드릴게요`)
      setTimeout(() => setMsg(''), 4000)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div
        className="box"
        style={{ aspectRatio: `${IW}/${IH}` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          stageRef.current?.dragStart(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => stageRef.current?.dragMove(e.clientX, e.clientY, e.currentTarget.parentElement!.clientWidth)}
        onPointerUp={() => stageRef.current?.dragEnd()}
        onPointerCancel={() => stageRef.current?.dragEnd()}
      >
        <div className="zw">
          <img ref={img} src="/demo/41.jpg" alt="왼손 사진 위에 고른 반지" draggable={false} />
          <div ref={tint} className="tint" />
          <canvas ref={shadow} />
          <canvas ref={out} />
        </div>
      </div>
      <div className="tools">
        <button className="chip" disabled={busy !== null} onClick={() => file.current?.click()}>
          {busy === null ? '내 손으로 해보기' : `손 찾는 중 ${busy}/${FRAME_COUNT}`}
        </button>
        {custom && busy === null && (
          <button className="chip" onClick={useDemo}>
            예시 손
          </button>
        )}
        {msg && <span className="note">{msg}</span>}
        <input
          ref={file}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </>
  )
}
