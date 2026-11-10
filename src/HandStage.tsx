import { useEffect, useRef } from 'react'
import { createStage } from './three/stage.ts'
import type { RingInfo, HandData } from './three/stage.ts'

const IW = 480
const IH = 854

// 손 사진 + 그 위에 3D 반지(그림자 캔버스, 반지 캔버스). 데이터는 public/rings.json, public/demo/hand.json
export default function HandStage() {
  const img = useRef<HTMLImageElement>(null)
  const tint = useRef<HTMLDivElement>(null)
  const shadow = useRef<HTMLCanvasElement>(null)
  const out = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<ReturnType<typeof createStage> | null>(null)

  useEffect(() => {
    let stage: ReturnType<typeof createStage> | null = null
    let dead = false
    Promise.all([
      fetch('/rings.json').then((r) => r.json() as Promise<RingInfo[]>),
      fetch('/demo/hand.json').then((r) => r.json() as Promise<HandData>),
    ]).then(([rings, hand]) => {
      if (dead) return
      stage = stageRef.current = createStage(
        { img: img.current!, tint: tint.current!, shadow: shadow.current!, out: out.current! },
        rings,
        hand,
      )
      const id = new URLSearchParams(location.search).get('ring') // 확인용: ?ring=SP
      if (id) stage.pick(id)
    })
    return () => {
      dead = true
      stage?.stop()
      stageRef.current = null
    }
  }, [])

  return (
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
  )
}
