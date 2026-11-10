import { useRef, useState } from 'react'
import HandStage from './HandStage.tsx'

export default function App() {
  // 토스 규칙: 처음 들어올 때 바텀시트가 자동으로 튀어나오면 안 됨 → 접힌 채로 시작
  const [open, setOpen] = useState(false)
  const startY = useRef<number | null>(null)

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (startY.current === null) return
    const dy = e.clientY - startY.current
    startY.current = null
    if (dy > 30) setOpen(false)
    else if (dy < -30) setOpen(true)
    else setOpen((o) => !o)
  }

  return (
    <div className="app">
      <div className="stage">
        <HandStage />
      </div>

      <section className={`sheet${open ? '' : ' collapsed'}`} aria-label="반지 고르기">
        <button
          className="grab-btn"
          aria-label={open ? '반지 고르기 접기' : '반지 고르기 펴기'}
          aria-expanded={open}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (startY.current = null)}
        >
          <span className="grab" />
          <span className="grab-t">▲ 반지 고르기</span>
        </button>
        {open && (
          <div className="sheet-body">
            <p className="empty">반지 목록이 여기에 들어와요</p>
          </div>
        )}
      </section>
    </div>
  )
}
