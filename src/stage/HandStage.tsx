import { useEffect, useRef, useState } from 'react'
import { IW, IH } from '../constants.ts'
import type { RingInfo } from '../three/types.ts'
import type { SavedSet, Snapshot } from './sets.ts'
import { useSaveSet } from './useSaveSet.ts'
import { useHandStage } from './useHandStage.ts'
import ToolsBar from './ToolsBar.tsx'
import FingerHints from './FingerHints.tsx'
import LiveCapture from '../screens/LiveCapture.tsx'
import Analyzing from '../screens/Analyzing.tsx'
import WornPanel from './WornPanel.tsx'

export type Menu = {
  rings: RingInfo[]
  thumbs: Record<string, string>
  pick: (id: string) => void
  initial: string
  state: () => Record<string, any>
  set: (patch: Record<string, any>) => void
  restore: (ho: number, rings: SavedSet['rings']) => boolean   // 저장한 세트를 그대로 다시 끼움
}

// 손 사진 + 그 위에 3D 반지(그림자 캔버스, 반지 캔버스). 반지 데이터는 public/rings.json
// 처음 들어오면 initialFile(영상 파일 또는 촬영한 프레임)을 분석하는 동안 분석 화면을 덮어 두고, 끝나면 걷음. 분석에 실패하면 onBack
export default function HandStage({ onReady, onActiveRing, initialFile, onBack, sets, onSaveSet, onViewSets }: { onReady: (m: Menu) => void; onActiveRing?: (id: string) => void; initialFile: File | Blob[]; onBack: () => void; sets: SavedSet[]; onSaveSet: (s: Snapshot) => boolean; onViewSets: () => void }) {
  const [live, setLive] = useState(false)   // 실시간 카메라 켜짐
  const [anDone, setAnDone] = useState(false)   // 분석 화면을 걷었는지
  const img = useRef<HTMLImageElement>(null)
  const shadow = useRef<HTMLCanvasElement>(null)
  const out = useRef<HTMLCanvasElement>(null)
  const dbg = useRef<HTMLCanvasElement>(null)
  // ?debug=1 이면 디버그(그림 + 설명 글자)를 켠 채로 시작, ?debug=2 면 그림만. 버튼을 누르면 꺼짐 → 1 → 2 → 꺼짐
  const debug0 = Number(new URLSearchParams(location.search).get('debug')) === 2 ? 2 : Number(new URLSearchParams(location.search).get('debug')) === 1 ? 1 : 0
  const wantDebug = debug0 > 0
  const [debug, setDebug] = useState(debug0)
  const [playing, setPlaying] = useState(true)
  const [setOpen, setSetOpen] = useState(false)   // 반지 세트 패널 열림
  const [pick, setPick] = useState(false)   // 반지 낄 손가락 고르는 중
  const setBtn = useRef<HTMLButtonElement>(null)

  const { stageRef, ringsRef, ho, setHo, an, anFail, info, slots, hints, busy, busyText, msg, loadHand: onFile } = useHandStage({
    els: { img, shadow, out, debug: dbg },
    initialFile,
    onReady,
    onActiveRing,
    debug0,
  })

  const choose = (v: boolean) => {   // 손가락 고르기 켜기/끄기 (켜면 영상 멈춤)
    setPick(v)
    stageRef.current?.setPick(v)
  }
  useEffect(() => {
    if (!setOpen && pick) choose(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOpen])

  const { saved, save, toast: saveToast, hideToast } = useSaveSet(stageRef, sets, onSaveSet)

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
      {saveToast && (
        <div className="toast" role="status">
          세트를 담았어요
          <button type="button" onClick={() => { hideToast(); onViewSets() }}>보기</button>
        </div>
      )}
      <WornPanel
        open={setOpen}
        slots={slots}
        rings={ringsRef.current}
        thumbs={(stageRef.current?.thumbs ?? {}) as Record<string, string>}
        pick={pick}
        saved={saved}
        onSave={save}
        ignore={setBtn}
        onClose={() => setSetOpen(false)}
        onSwitch={(i) => stageRef.current?.switchSlot(i)}
        onRemove={(i) => stageRef.current?.removeSlot(i)}
        onTogglePick={() => choose(!pick)}
      />
      <ToolsBar
        setBtn={setBtn}
        setOpen={setOpen}
        slotCount={slots.length}
        onToggleSet={() => setSetOpen((o) => !o)}
        ho={ho}
        onHo={(v) => { setHo(v); stageRef.current?.setHo(v) }}
        debugVisible={wantDebug}
        debug={debug}
        onDebug={() => { const next = (debug + 1) % 3; stageRef.current?.setDebug(next); setDebug(next) }}
        busy={busy}
        busyText={busyText}
        onCamera={() => setLive(true)}
        onAlbumFile={onFile}
        playing={playing}
        onPlay={() => { stageRef.current?.setPlaying(!playing); setPlaying(!playing) }}
        notes={[msg, info].filter(Boolean)}
      />
      {live && <LiveCapture onDone={(fr) => { setLive(false); onFile(fr) }} onClose={() => setLive(false)} />}
      {!anDone && <Analyzing target={an} error={anFail} onBack={onBack} onFinish={() => setAnDone(true)} />}
    </>
  )
}
