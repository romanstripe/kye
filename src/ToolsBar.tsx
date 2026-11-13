import { useRef } from 'react'
import type { RefObject } from 'react'
import { FRAME_COUNT } from './hand/analyze.ts'
import HoPicker from './HoPicker.tsx'
import { CameraIcon, AlbumIcon } from './Landing.tsx'

// 손 화면 위쪽 버튼 줄: 반지 세트 / 내 호수 / (가까이·디버그: 숨김) / 다시 찍기·앨범 / 재생·멈춤 + 안내 글자
export default function ToolsBar({
  setBtn, setOpen, slotCount, onToggleSet,
  ho, onHo,
  zoom, onZoom,
  debugVisible, debug, onDebug,
  busy, busyText, onCamera, onAlbumFile,
  playing, onPlay,
  notes,
}: {
  setBtn: RefObject<HTMLButtonElement | null>   // 반지 세트 버튼 (패널이 이 버튼을 누른 건 바깥 누름으로 치지 않게 넘겨 줌)
  setOpen: boolean
  slotCount: number
  onToggleSet: () => void
  ho: number
  onHo: (v: number) => void
  zoom: boolean
  onZoom: () => void
  debugVisible: boolean   // ?debug=1 일 때만 버튼이 보임
  debug: boolean
  onDebug: () => void
  busy: number | null   // 새 손을 분석 중이면 처리한 프레임 수, 아니면 null
  busyText: string
  onCamera: () => void
  onAlbumFile: (f: File | undefined) => void
  playing: boolean
  onPlay: () => void
  notes: string[]
}) {
  const album = useRef<HTMLInputElement>(null)
  return (
    <div className="tools">
      <button ref={setBtn} className="chip setb" aria-expanded={setOpen} aria-controls="worn" onClick={onToggleSet}>
        반지 세트
        {slotCount > 1 && <span className="cnt">{slotCount}</span>}
      </button>
      <HoPicker value={ho} onChange={onHo} />
      <button className="chip" hidden aria-pressed={zoom} onClick={onZoom}>
        가까이
      </button>
      <button className="chip" hidden={!debugVisible} aria-pressed={debug} onClick={onDebug}>
        디버그
      </button>
      {busy === null ? (
        <>
          <button className="chip icon" aria-label="내 손 다시 찍기" onClick={onCamera}>
            <CameraIcon size={18} />
          </button>
          <button className="chip icon" aria-label="앨범에서 영상 올리기" onClick={() => album.current?.click()}>
            <AlbumIcon size={18} />
          </button>
        </>
      ) : (
        <button className="chip" disabled>
          {busy === 0 && busyText ? busyText : `손 찾는 중 ${busy}/${FRAME_COUNT}`}
        </button>
      )}
      <button className="chip playb" aria-pressed={!playing} aria-label={playing ? '손 영상 멈추기' : '손 영상 재생'} onClick={onPlay}>
        {playing ? '❚❚' : '▶'}
      </button>
      {notes.map((t, i) => <span className="note" key={i}>{t}</span>)}
      <input
        ref={album}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          onAlbumFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
