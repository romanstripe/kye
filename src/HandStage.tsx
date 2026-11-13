import { useEffect, useRef, useState } from 'react'
import { createStage } from './three/stage.ts'
import type { RingInfo, HandData } from './three/stage.ts'
import { analyzeVideo, analyzeFrames, revokeHand, FRAME_COUNT } from './hand/analyze.ts'
import HoPicker from './HoPicker.tsx'
import FingerHints from './FingerHints.tsx'
import type { Hint } from './FingerHints.tsx'
import { CameraIcon } from './Landing.tsx'
import LiveCapture from './LiveCapture.tsx'
import Analyzing from './Analyzing.tsx'
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

// 손 사진 + 그 위에 3D 반지(그림자 캔버스, 반지 캔버스). 반지 데이터는 public/rings.json
// 처음 들어오면 initialFile(영상 파일 또는 촬영한 프레임)을 분석하는 동안 분석 화면을 덮어 두고, 끝나면 걷음. 분석에 실패하면 onBack
export default function HandStage({ onReady, onActiveRing, initialFile, onBack }: { onReady: (m: Menu) => void; onActiveRing?: (id: string) => void; initialFile: File | Blob[]; onBack: () => void }) {
  const [live, setLive] = useState(false)   // 실시간 카메라 켜짐
  const album = useRef<HTMLInputElement>(null)
  const [an, setAn] = useState(0)   // 분석 화면의 진행 단계 (0 손 찾기, 1 굵기 재기, 3 끝)
  const [anFail, setAnFail] = useState('')
  const [anDone, setAnDone] = useState(false)   // 분석 화면을 걷었는지
  const img = useRef<HTMLImageElement>(null)
  const shadow = useRef<HTMLCanvasElement>(null)
  const out = useRef<HTMLCanvasElement>(null)
  const dbg = useRef<HTMLCanvasElement>(null)
  const wantDebug = new URLSearchParams(location.search).get('debug') === '1'   // ?debug=1 이면 디버그를 켠 채로 시작
  const [debug, setDebug] = useState(wantDebug)
  const [info, setInfo] = useState('')
  const stageRef = useRef<ReturnType<typeof createStage> | null>(null)
  const mine = useRef<HandData | null>(null)
  const [busy, setBusy] = useState<number | null>(null) // 처리한 프레임 수
  const [stage, setStage] = useState('')
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
    // 반지 목록과 손 분석을 같이 시작. 손이 준비돼야 무대를 만듦
    Promise.all([
      fetch('/rings.json').then((r) => r.json() as Promise<{ rings: RingInfo[] }>).then((j) => j.rings),
      (Array.isArray(initialFile) ? analyzeFrames : analyzeVideo)(initialFile as never, () => {}),
    ]).then(([rings, hand]) => {
      if (dead) return revokeHand(hand)
      mine.current = hand
      ringsRef.current = rings
      setAn(1)   // 손 찾기 끝 → 손가락 굵기 재는 중 (무대가 뒤에서 굵기를 재고, 끝나면 onMeasured)
      stage = stageRef.current = createStage(
        { img: img.current!, shadow: shadow.current!, out: out.current!, debug: dbg.current!, onInfo: setInfo, onMeasured: () => setAn(3), onHints: setHints, onSlots: (l) => { setSlots(l); const a = l.find((x) => x.active); if (a) active.current?.(a.id) } },
        rings,
        hand,
      )
      if (wantDebug) stage.setDebug(true)
      ready.current({ rings, thumbs: stage.thumbs, pick: stage.pick, state: stage.state, set: stage.set, initial: rings[0].id })
    }).catch((e) => !dead && setAnFail(e instanceof Error ? e.message : '분석에 실패했어요'))
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

  const onFile = async (f: File | Blob[] | undefined) => {
    if (!f || !stageRef.current) return
    setMsg('')
    setBusy(0)
    try {
      const hand = await (Array.isArray(f) ? analyzeFrames : analyzeVideo)(f as never,(n, _t, st) => (setBusy(n), st && setStage(st)))
      const old = mine.current
      mine.current = hand
      stageRef.current?.setHand(hand)
      if (old) revokeHand(old)
    } catch (e) {
      // 손을 못 찾거나 영상이 이상하면 안내만 하고 화면은 그대로
      setMsg(`${e instanceof Error ? e.message : '분석에 실패했어요'}. 카메라 버튼으로 다시 찍어 주세요`)
      setTimeout(() => setMsg(''), 6000)
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
          <img ref={img} alt="왼손 사진 위에 고른 반지" draggable={false} />
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
        {busy === null ? (
          <>
            <button className="chip icon" aria-label="내 손 다시 찍기" onClick={() => setLive(true)}>
              <CameraIcon size={18} />
            </button>
            <button className="chip" onClick={() => album.current?.click()}>
              앨범
            </button>
          </>
        ) : (
          <button className="chip" disabled>
            {busy === 0 && stage ? stage : `손 찾는 중 ${busy}/${FRAME_COUNT}`}
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
          ref={album}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {live && <LiveCapture onDone={(fr) => { setLive(false); onFile(fr) }} onClose={() => setLive(false)} />}
      {!anDone && <Analyzing target={an} error={anFail} onBack={onBack} onFinish={() => setAnDone(true)} />}
    </>
  )
}
