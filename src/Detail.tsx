import { useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Menu } from './HandStage.tsx'
import type { RingInfo } from './three/stage.ts'
import { CUTS as CUTS_, GEMS as GEMS_, NUDO_GEMS, SIX, stoneSize } from './three/sol.ts'

const CUTS: Record<string, { n: string }> = CUTS_
const GEMS: Record<string, { n: string }> = GEMS_

// 반지 자세히 설정: 한 줄에 한 항목(왼쪽 회색 라벨 + 오른쪽 칩 가로 스크롤). 색상·폭·파베·가드링이 맨 위 네 줄
type Opt = [string | number | boolean, string]
const METAL: [string, string, string][] = [['PG', '로즈골드', '#e9b49e'], ['YG', '옐로골드', '#e8c06a'], ['WG', '화이트골드', '#dfe2e6']]
const GAPS: Opt[] = [[0.5, '딱 붙여서'], [1.7, '살짝 띄워서'], [2.5, '띄워서']]   // 같은 손가락에 쌓을 때 앞 반지와의 간격(mm)
const SAME_METAL: Opt[] = [['same', '같은 색'], ...METAL.map(([v, n]): Opt => [v, n])]

// 칩 글자 줄이기: "미니 (가운데 1줄)"→"미니", "스파이럴 파베"→"스파이럴", "4mm · 두 줄"→"4mm"
const short = (t: string) => {
  const s = t.replace(/\s*\(.*?\)/g, '').split(' · ')[0].trim()
  return s.replace(/\s*파베$/, '') || s
}

function Chips({ opts, cur, onPick }: { opts: Opt[]; cur: unknown; onPick: (v: any) => void }) {
  return (
    <div className="dchips">
      {opts.map(([v, label]) => (
        <button key={String(v)} type="button" className="dchip" aria-pressed={v === cur} onClick={() => onPick(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// 칩이 가로로 넘치면(오른쪽에 더 있으면) 오른쪽 끝을 살짝 페이드
function Scroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState(false)
  const check = () => {
    const el = ref.current
    if (el) setFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 2)
  }
  useLayoutEffect(check)
  return (
    <div ref={ref} className={`dscroll${fade ? ' fade' : ''}`} onScroll={check}>
      {children}
    </div>
  )
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="drow">
    <div className="dl">{label}</div>
    <Scroller>{children}</Scroller>
  </div>
)

export default function Detail({ ring: c, menu, onBack }: { ring: RingInfo; menu: Menu; onBack: () => void }) {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const s = menu.state()
  const set = (patch: Record<string, unknown>) => {
    menu.set(patch)
    bump()
  }
  const isSol = c.id === 'SOL'
  const paveKeys = (['semi', 'alt', 'full', 'both'] as const).filter((k) => c.pave[k])

  let solInfo = ''
  if (isSol) {
    const { W, L } = stoneSize()
    const dim = Math.abs(W - L) < 0.05 ? `지름 약 ${W.toFixed(1)}mm` : `약 ${L.toFixed(1)} × ${W.toFixed(1)}mm`
    const note =
      s.GEM === 'lab' ? ' · 눈으로는 천연과 같아요'
      : s.GEM === 'opal' ? ' · 가벼워서 같은 캐럿이면 더 커요'
      : s.GEM === 'emer' ? ' · 가벼워서 조금 더 커요'
      : ['sap', 'ruby', 'gar'].includes(s.GEM) ? ' · 무거워서 조금 작아요'
      : ''
    solInfo = `${CUTS[s.CUT].n} ${s.CT}ct ${GEMS[s.GEM].n} · ${dim}${note}`
  }

  return (
    <>
      <div className="dh">
        <button className="dback" aria-label="반지 목록으로" onClick={onBack}>‹</button>
        <b>{c.name}</b>
        <span>{c.sub}</span>
        <button className="ddone" onClick={onBack}>완료</button>
      </div>
      <div className="dbody">
        {c.metal && (
          <Row label="색상">
            <div className="dcolors">
              {METAL.map(([v, name, dot]) => (
                <button key={v} type="button" className="cdot" aria-label={name} aria-pressed={v === s.METAL} style={{ background: dot }} onClick={() => set({ METAL: v })} />
              ))}
              <span className="cname">{METAL.find(([v]) => v === s.METAL)?.[1]}</span>
            </div>
          </Row>
        )}
        {c.widths.length >= 2 && (
          <Row label="폭">
            <Chips opts={c.widths.map((w): Opt => [w, short(c.widthLabels?.[String(w)] ?? `${w}mm`)])} cur={s.WMM} onPick={(v) => set({ WMM: v })} />
          </Row>
        )}
        {paveKeys.length > 0 && (
          <Row label="파베">
            <Chips opts={[['none', '없음'], ...paveKeys.map((k): Opt => [k, short(c.pave[k]!.label)])]} cur={s.PAVE} onPick={(v) => set({ PAVE: v })} />
          </Row>
        )}
        <Row label="가드링">
          <Chips opts={[[0, '없음'], [1, '1.0'], [1.5, '1.5'], [2, '2.0'], [2.5, '2.5mm']]} cur={s.GW} onPick={(v) => set({ GW: v })} />
        </Row>
        {s.GW > 0 && (
          <>
            <Row label="가드 파베">
              <Chips opts={[[false, '매끈하게'], [true, '파베']]} cur={s.GPAVE} onPick={(v) => set({ GPAVE: v })} />
            </Row>
            <Row label="가드 색">
              <Chips opts={SAME_METAL} cur={s.GMETAL} onPick={(v) => set({ GMETAL: v })} />
            </Row>
          </>
        )}
        {s.stacked && (
          <Row label="간격">
            <Chips opts={GAPS} cur={s.GAPMM} onPick={(v) => set({ GAPMM: v })} />
          </Row>
        )}
        {c.rimColor && (
          <Row label="테두리">
            <Chips opts={SAME_METAL} cur={s.RMETAL} onPick={(v) => set({ RMETAL: v })} />
          </Row>
        )}
        {c.diy && (
          <Row label="두께">
            <Chips opts={[[1.2, '얇게 1.2mm'], [1.8, '보통 1.8mm'], [2.6, '두껍게 2.6mm']]} cur={s.WALL} onPick={(v) => set({ WALL: v })} />
          </Row>
        )}
        {isSol && (
          <>
            <Row label="컷">
              <Chips opts={Object.entries(CUTS).map(([k, o]): Opt => [k, o.n])} cur={s.CUT} onPick={(v) => set({ CUT: v })} />
            </Row>
            {SIX[s.CUT as keyof typeof SIX] && (
              <Row label="발">
                <Chips opts={[[4, '4발'], [6, '6발']]} cur={s.PRONG} onPick={(v) => set({ PRONG: v })} />
              </Row>
            )}
            <Row label="캐럿">
              <Chips opts={[0.3, 0.5, 1, 1.5, 2, 3].map((k): Opt => [k, `${k}ct`])} cur={s.CT} onPick={(v) => set({ CT: v })} />
            </Row>
          </>
        )}
        {(isSol || c.gemPick) && (
          <Row label="알">
            <Chips opts={(isSol ? Object.keys(GEMS) : NUDO_GEMS).map((k): Opt => [k, GEMS[k].n])} cur={s.GEM} onPick={(v) => set({ GEM: v })} />
          </Row>
        )}
        {solInfo && <div className="dinfo">{solInfo}</div>}
      </div>
    </>
  )
}
