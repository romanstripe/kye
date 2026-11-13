import { useRef, useState } from 'react'
import HandStage from './HandStage.tsx'
import type { Menu } from './HandStage.tsx'
import Wheel from './Wheel.tsx'
import Detail from './Detail.tsx'
import Landing from './Landing.tsx'

export default function App() {
  // 처음부터 펼쳐진 채로 보임 (애니메이션으로 튀어나오지 않음). 접힌 채로 시작하려면 false
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [sel, setSel] = useState('')
  const [view, setView] = useState<'list' | 'detail'>('list')
  const startY = useRef<number | null>(null)
  const [screen, setScreen] = useState<'landing' | 'main'>('landing')
  const [file, setFile] = useState<File | Blob[] | undefined>()   // 랜딩에서 찍은 영상(파일) 또는 실시간 촬영 프레임

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

  if (screen === 'landing')
    return (
      <Landing
        onFile={(f) => { setFile(f); setMenu(null); setScreen('main') }}
        onDemo={() => { setFile(undefined); setMenu(null); setScreen('main') }}
      />
    )

  return (
    <div className="app">
      <div className="stage">
        <HandStage
          initialFile={file}
          onActiveRing={setSel}
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
          <span className="grab-t">
            <svg className={`chev${open ? ' down' : ''}`} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 15l7-7 7 7" />
            </svg>
            <b>{menu?.rings.find((r) => r.id === sel)?.name ?? ''}</b>
            <i />
            <span>반지 고르기</span>
          </span>
        </button>
        {open && menu && view === 'detail' && (
          <Detail ring={menu.rings.find((r) => r.id === sel)!} menu={menu} onBack={() => setView('list')} />
        )}
        {open && view === 'list' && (
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
            <button className="primary" style={{ marginTop: 14 }} disabled={!menu} onClick={() => setView('detail')}>
              이 반지 자세히 설정
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
