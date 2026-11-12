import { useEffect, useRef, useState } from 'react'
import { createStage } from './three/stage.ts'
import type { RingInfo, HandData } from './three/stage.ts'
import { analyzeVideo, revokeHand, FRAME_COUNT } from './hand/analyze.ts'
import HoPicker from './HoPicker.tsx'
import FingerHints from './FingerHints.tsx'
import type { Hint } from './FingerHints.tsx'
import WornPanel from './WornPanel.tsx'
import type { Slot } from './WornPanel.tsx'

export type Menu = {
  rings: RingInfo[]
  thumbs: Record<string, string>
  pick: (id: string) => void
  initial: string
  state: () => Record<string, any>
  set: (patch: Record<string, any>) => void
}

const IW = 480
const IH = 854

// 손 사진 + 그 위에 3D 반지(그림자 캔버스, 반지 캔버스). 데이터는 public/rings.json, public/demo/hand.json
// 내 영상을 올리면 그 손으로, 실패하거나 안 올리면 예시 손으로 보여줌
export default function HandStage({ onReady, onActiveRing }: { onReady: (m: Menu) => void; onActiveRing?: (id: string) => void }) {
  const img = useRef<HTMLImageElement>(null)
  const shadow = useRef<HTMLCanvasElement>(null)
  const out = useRef<HTMLCanvasElement>(null)
  const dbg = useRef<HTMLCanvasElement>(null)
  const [debug, setDebug] = useState(false)
  const [info, setInfo] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const stageRef = useRef<ReturnType<typeof createStage> | null>(null)
  const demo = useRef<HandData | null>(null)
  const mine = useRef<HandData | null>(null)
  const [busy, setBusy] = useState<number | null>(null) // 처리한 프레임 수
  const [custom, setCustom] = useState(false)
  const [msg, setMsg] = useState('')
  const [playing, setPlaying] = useState(true)
  const [zoom, setZoom] = useState(false)
  const [setOpen, setSetOpen] = useState(false)   // 반지 세트 패널 열림
  const [slots, setSlots] = useState<Slot[]>([])   // 끼운 반지들
  const [pick, setPick] = useState(false)   // 반지 낄 손가락 고르는 중
  const [hints, setHints] = useState<Hint[]>([])   // 손가락마다 ＋ 점 자리(px)
  const active = useRef(onActiveRing)
  active.current = onActiveRing
  const ringsRef = useRef<RingInfo[]>([])
  const setBtn = useRef<HTMLButtonElement>(null)
  const ready = useRef(onReady)
  ready.current = onReady

  useEffect(() => {
    let stage: ReturnType<typeof createStage> | null = null
    let dead = false
    Promise.all([
      fetch('/rings.json').then((r) => r.json() as Promise<{ rings: RingInfo[] }>).then((j) => j.rings),
      fetch('/demo/hand.json').then((r) => r.json()),
    ]).then(([rings, raw]) => {
      if (dead) return
      // public/demo/hand.json: ringPose=프레임별 반지 자리, landmarks=손 21점, playFrom~playTo=왕복 재생 구간
      const hand: HandData = {
        N: raw.count,
        P: raw.ringPose,
        LMS: raw.landmarks,
        pmin: raw.playFrom,
        pmax: raw.playTo,
        frames: Array.from({ length: raw.count }, (_, i) => `/demo/frames/${String(i).padStart(2, '0')}.jpg`),
      }
      demo.current = hand
      ringsRef.current = rings
      stage = stageRef.current = createStage(
        { img: img.current!, shadow: shadow.current!, out: out.current!, debug: dbg.current!, onInfo: setInfo, onHints: setHints, onSlots: (l) => { setSlots(l); const a = l.find((x) => x.active); if (a) active.current?.(a.id) } },
        rings,
        hand,
      )
      ready.current({ rings, thumbs: stage.thumbs, pick: stage.pick, state: stage.state, set: stage.set, initial: rings[0].id })
    })
    return () => {
      dead = true
      stage?.stop()
      stageRef.current = null
      if (mine.current) revokeHand(mine.current)
    }
  }, [])

  const choose = (v: boolean) => {   // 손가락 고르기 켜기/끄기 (켜면 영상 멈춤)
    setPick(v)
    stageRef.current?.setPick(v)
  }
  useEffect(() => {
    if (!setOpen && pick) choose(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOpen])

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
          <img ref={img} src="/demo/frames/41.jpg" alt="왼손 사진 위에 고른 반지" draggable={false} />
          <canvas ref={shadow} />
          <canvas ref={out} />
          <canvas ref={dbg} width={IW * 2} height={IH * 2} />
          {pick && (
            <FingerHints
              hints={hints}
              onPick={(f) => {
                choose(false)
                stageRef.current?.addSlot(f)
              }}
            />
          )}
        </div>
      </div>
      {pick && <div className="toast">반지 낄 손가락을 눌러 주세요</div>}
      <WornPanel
        open={setOpen}
        slots={slots}
        rings={ringsRef.current}
        thumbs={(stageRef.current?.thumbs ?? {}) as Record<string, string>}
        pick={pick}
        ignore={setBtn}
        onClose={() => setSetOpen(false)}
        onSwitch={(i) => stageRef.current?.switchSlot(i)}
        onRemove={(i) => stageRef.current?.removeSlot(i)}
        onTogglePick={() => choose(!pick)}
      />
      <div className="tools">
        <button
          ref={setBtn}
          className="chip setb"
          aria-expanded={setOpen}
          aria-controls="worn"
          onClick={() => setSetOpen((o) => !o)}
        >
          반지 세트
          {slots.length > 1 && <span className="cnt">{slots.length}</span>}
        </button>
        <HoPicker onChange={(v) => stageRef.current?.setHo(v)} />
        <button
          className="chip"
          hidden
          aria-pressed={zoom}
          onClick={() => {
            stageRef.current?.setZoom(!zoom)
            setZoom(!zoom)
          }}
        >
          가까이
        </button>
        <button
          className="chip"
          aria-pressed={debug}
          onClick={() => {
            stageRef.current?.setDebug(!debug)
            setDebug(!debug)
          }}
        >
          디버그
        </button>
        <button className="chip" disabled={busy !== null} onClick={() => file.current?.click()}>
          {busy === null ? '내 손으로 해보기' : `손 찾는 중 ${busy}/${FRAME_COUNT}`}
        </button>
        {custom && busy === null && (
          <button className="chip" onClick={useDemo}>
            예시 손
          </button>
        )}
        <button
          className="chip playb"
          aria-pressed={!playing}
          aria-label={playing ? '손 영상 멈추기' : '손 영상 재생'}
          onClick={() => {
            stageRef.current?.setPlaying(!playing)
            setPlaying(!playing)
          }}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        {msg && <span className="note">{msg}</span>}
        {info && <span className="note">{info}</span>}
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
