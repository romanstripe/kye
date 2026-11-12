import { useEffect, useRef, useState } from 'react'
import { createStage } from './three/stage.ts'
import type { RingInfo, HandData } from './three/stage.ts'
import { analyzeVideo, revokeHand, FRAME_COUNT } from './hand/analyze.ts'
import { FINGERS, FINGER_NAME } from './hand/width.ts'
import type { Finger } from './hand/width.ts'

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
  const [slots, setSlots] = useState<{ id: string; active: boolean; finger: string }[]>([])   // 끼운 반지들
  const [pick, setPick] = useState(false)   // 반지 낄 손가락 고르는 중
  const [hints, setHints] = useState<{ f: string; name: string; x: number; y: number }[]>([])   // 손가락마다 ＋ 점 자리(px)
  const active = useRef(onActiveRing)
  active.current = onActiveRing
  const worn = useRef<HTMLDivElement>(null)
  const ringsRef = useRef<RingInfo[]>([])
  const setBtn = useRef<HTMLButtonElement>(null)
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

  useEffect(() => {
    if (!setOpen) return
    const close = (e: PointerEvent) => {
      const t = e.target as Node
      if (pick) return
      if (!worn.current?.contains(t) && !setBtn.current?.contains(t)) setSetOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [setOpen, pick])

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
            <div className="hints">
              {hints.map((h) => (
                <button
                  key={h.f}
                  type="button"
                  className="hint"
                  aria-label={`${h.name}에 끼기`}
                  style={{ left: `${(h.x / IW) * 100}%`, top: `${(h.y / IH) * 100}%` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    choose(false)
                    stageRef.current?.addSlot(h.f)
                  }}
                >
                  ＋<span>{h.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {pick && <div className="toast">반지 낄 손가락을 눌러 주세요</div>}
      <div ref={worn} id="worn" className={`stack${setOpen ? ' open' : ''}`} aria-label="끼운 반지 (위가 손톱 쪽)">
        {(() => {
          const act = slots.find((s) => s.active)
          const used = FINGERS.filter((f) => slots.some((s) => s.finger === f))
          const mine = slots.map((sl, i) => ({ ...sl, i })).filter((s) => s.finger === (act?.finger ?? 'ring')).reverse()   // 지금 손가락의 층만, 위 = 손톱 쪽
          return (
            <>
              {used.length > 1 && (
                <div className="fsw">
                  {used.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={f === act?.finger}
                      onClick={() => {
                        const l = slots.map((s, i) => ({ ...s, i })).filter((s) => s.finger === f)
                        stageRef.current?.switchSlot(l[l.length - 1].i)
                      }}
                    >
                      {FINGER_NAME[f]}
                    </button>
                  ))}
                </div>
              )}
              {slots.length < 8 && (
                <button type="button" className="addl" aria-label="반지 하나 더 끼기" aria-pressed={pick} onClick={() => choose(!pick)}>
                  ＋
                </button>
              )}
              {mine.map(({ id, active: on, i, finger }) => {
                const name = ringsRef.current.find((r) => r.id === id)?.name ?? id
                return (
                  <button
                    key={i}
                    type="button"
                    className="lay"
                    aria-pressed={on}
                    aria-label={`${FINGER_NAME[finger as Finger]} ${name}`}
                    onClick={() => stageRef.current?.switchSlot(i)}
                  >
                    <img alt="" src={(stageRef.current?.thumbs as Record<string, string> | undefined)?.[id] ?? ''} />
                    {on && slots.length > 1 && (
                      <span
                        className="x"
                        role="button"
                        aria-label="이 반지 빼기"
                        onClick={(e) => {
                          e.stopPropagation()
                          stageRef.current?.removeSlot(i)
                        }}
                      >
                        ✕
                      </span>
                    )}
                  </button>
                )
              })}
              {used.length === 1 && used[0] !== 'ring' && <span className="lbl">{FINGER_NAME[used[0]]}</span>}
            </>
          )
        })()}
      </div>
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
