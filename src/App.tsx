import { useRef, useState } from 'react'
import HandStage from './HandStage.tsx'
import type { Menu } from './HandStage.tsx'
import Wheel from './Wheel.tsx'
import Detail from './Detail.tsx'
import Landing from './Landing.tsx'
import SetsList from './SetsList.tsx'
import { loadSets, addSet, removeSet } from './sets.ts'
import type { SavedSet } from './sets.ts'

export default function App() {
  // 처음부터 펼쳐진 채로 보임 (애니메이션으로 튀어나오지 않음). 접힌 채로 시작하려면 false
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [sel, setSel] = useState('')
  const [view, setView] = useState<'list' | 'detail'>('list')
  const startY = useRef<number | null>(null)
  const [tab, setTab] = useState<'pick' | 'sets'>('pick')   // 시트 탭: 반지 고르기 / 내 세트
  const [sets, setSets] = useState<SavedSet[]>(loadSets)   // 저장한 세트 (localStorage)
  const [edit, setEdit] = useState(false)   // 내 세트 편집(빨간 − 로 지우기)
  const visible = menu ? sets.filter((s) => s.rings.some((r) => menu.rings.some((c) => c.id === r.ringId))) : sets   // 반지가 하나도 없는 저장본은 안 보임
  const go = (t: 'pick' | 'sets') => { setTab(t); setOpen(true); setEdit(false) }
  const again = (s: SavedSet) => {   // 다시 껴 보기: 호수·반지 전부 복원하고 반지 고르기 탭으로
    if (!menu?.restore(s.ringSize, s.rings)) return
    setTab('pick'); setView('list'); setEdit(false)
  }
  const [screen, setScreen] = useState<'landing' | 'main'>('landing')
  const detailing = open && tab === 'pick' && view === 'detail'   // 반지 자세히 설정 중
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
      <Landing onFile={(f) => { setFile(f); setMenu(null); setScreen('main') }} />
    )

  return (
    <div className="app">
      <div className="stage">
        <HandStage
          initialFile={file!}
          sets={sets}
          onSaveSet={(snap) => { const r = addSet(snap); setSets(r.sets); return r.added }}
          onViewSets={() => go('sets')}
          onBack={() => { setFile(undefined); setMenu(null); setScreen('landing') }}
          onActiveRing={setSel}
          onReady={(m) => {
            setMenu(m)
            setSel(m.initial)
          }}
        />
      </div>

      <section className={`sheet${open ? '' : ' collapsed'}${detailing ? ' detail' : ''}`} aria-label="반지 고르기">
        {!detailing && <div className="grab-row">
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
            </span>
          </button>
          <i className="gsep" />
          <button type="button" className="tab" aria-pressed={tab === 'pick'} onClick={() => go('pick')}>반지 고르기</button>
          <i className="gsep" />
          <button type="button" className="tab" aria-pressed={tab === 'sets'} onClick={() => go('sets')}>
            내 세트{visible.length > 0 && <span className="bd">{visible.length}</span>}
          </button>
          {open && tab === 'sets' && visible.length > 0 && (
            <button type="button" className="gedit" onClick={() => setEdit((e) => !e)}>{edit ? '완료' : '편집'}</button>
          )}
        </div>}
        {open && tab === 'sets' && menu && (
          <SetsList
            sets={visible}
            rings={menu.rings}
            thumbs={menu.thumbs}
            edit={edit}
            onPick={again}
            onRemove={(id) => { const next = removeSet(id); setSets(next); if (!next.length) setEdit(false) }}
          />
        )}
        {open && tab === 'pick' && menu && view === 'detail' && (
          <Detail ring={menu.rings.find((r) => r.id === sel)!} menu={menu} onBack={() => setView('list')} />
        )}
        {open && tab === 'pick' && view === 'list' && (
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
