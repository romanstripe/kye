import { useEffect, useRef, useState } from 'react'
import { createStage } from './three/stage.ts'
import type { RingInfo, HandData } from './three/stage.ts'
import { analyzeVideo, revokeHand, FRAME_COUNT } from './hand/analyze.ts'

export type Menu = {
  rings: RingInfo[]
  thumbs: Record<string, string>
  pick: (id: string) => void
  initial: string
  state: () => Record<string, any>
  set: (patch: Record<string, any>) => void
}

// 내 호수 5~25호, 0.5 단위
const HOS = Array.from({ length: 41 }, (_, i) => 5 + i * 0.5)

const IW = 480
const IH = 854

// 손 사진 + 그 위에 3D 반지(그림자 캔버스, 반지 캔버스). 데이터는 public/rings.json, public/demo/hand.json
// 내 영상을 올리면 그 손으로, 실패하거나 안 올리면 예시 손으로 보여줌
export default function HandStage({ onReady }: { onReady: (m: Menu) => void }) {
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
  const [setOpen, setSetOpen] = useState(false)   // 반지 세트 패널 (아직 내용 없음)
  const [ho, setHo] = useState(17.5)
  const [hoOpen, setHoOpen] = useState(false)
  const hoBtn = useRef<HTMLButtonElement>(null)
  const hoPop = useRef<HTMLDivElement>(null)
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
      stage = stageRef.current = createStage(
        { img: img.current!, shadow: shadow.current!, out: out.current!, debug: dbg.current!, onInfo: setInfo },
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

  // 호수 목록: 열 때 고른 호수가 가운데 오게, 바깥을 누르면 닫힘
  useEffect(() => {
    if (!hoOpen) return
    const on = hoPop.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (on && hoPop.current) hoPop.current.scrollTop = on.offsetTop - hoPop.current.clientHeight / 2 + 18
    const close = (e: PointerEvent) => {
      const t = e.target as Node
      if (!hoPop.current?.contains(t) && !hoBtn.current?.contains(t)) setHoOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [hoOpen])

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
        </div>
      </div>
      <div className="tools">
        <button
          className="chip setb"
          aria-expanded={setOpen}
          aria-controls="worn"
          onClick={() => setSetOpen((o) => !o)}
        >
          반지 세트
        </button>
        <button
          ref={hoBtn}
          type="button"
          className="chip pick"
          aria-haspopup="listbox"
          aria-expanded={hoOpen}
          onClick={() => setHoOpen((o) => !o)}
        >
          <span>내 호수</span> <b>{ho}호</b>
        </button>
        {hoOpen && (
          <div
            ref={hoPop}
            className="hopop"
            role="listbox"
            aria-label="내 반지 호수"
            style={{ top: (hoBtn.current?.getBoundingClientRect().bottom ?? 0) + 6, left: hoBtn.current?.getBoundingClientRect().left ?? 0 }}
          >
            {HOS.map((v) => (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={v === ho}
                onClick={() => {
                  stageRef.current?.setHo(v)
                  setHo(v)
                  setHoOpen(false)
                }}
              >
                {v}호
              </button>
            ))}
          </div>
        )}
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
