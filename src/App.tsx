import { useRef, useState } from 'react'
import HandStage from './HandStage.tsx'
import type { Menu } from './HandStage.tsx'
import Wheel from './Wheel.tsx'

export default function App() {
  // 처음부터 펼쳐진 채로 보임 (애니메이션으로 튀어나오지 않음). 접힌 채로 시작하려면 false
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [sel, setSel] = useState('')
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
        <HandStage
          onReady={(m) => {
            setMenu(m)
            setSel(m.initial)
          }}
        />
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
          <span className="grab-t">▲ {menu?.rings.find((r) => r.id === sel)?.name ?? ''} · 반지 고르기</span>
        </button>
        {open && (
          <div>
            {menu && (
              <Wheel
                rings={menu.rings}
                thumbs={menu.thumbs}
                sel={sel}
                onPick={(id) => {
                  menu.pick(id)
                  setSel(id)
                }}
              />
            )}
          </div>
        )}
      </section>
    </div>
  )
}
