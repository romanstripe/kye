import { useReducer } from 'react'
import type { Menu } from './HandStage.tsx'
import type { RingInfo } from './three/stage.ts'
import { CUTS as CUTS_, GEMS as GEMS_, NUDO_GEMS, SIX, stoneSize } from './three/sol.ts'

const CUTS: Record<string, { n: string }> = CUTS_
const GEMS: Record<string, { n: string }> = GEMS_

// 반지 자세히 설정 (원본 데모 renderDetail 과 같은 항목·같은 순서)
type Opt = [string | number | boolean, string, string?]
const METAL: Opt[] = [['PG', '로즈골드', '#e9b49e'], ['YG', '옐로골드', '#e8c06a'], ['WG', '화이트골드', '#dfe2e6']]
const GAPS: Opt[] = [[0.5, '딱 붙여서'], [1.7, '살짝 띄워서'], [2.5, '띄워서']]   // 같은 손가락에 쌓을 때 앞 반지와의 간격(mm)
const SAME_METAL: Opt[] = [['same', '반지와 같은 색'], ...METAL]

function Chips({ opts, cur, onPick }: { opts: Opt[]; cur: unknown; onPick: (v: any) => void }) {
  return (
    <div className="chips">
      {opts.map(([v, label, dot]) => (
        <button key={String(v)} type="button" aria-pressed={v === cur} onClick={() => onPick(v)}>
          {dot && <i style={{ background: dot }} />}
          {label}
        </button>
      ))}
    </div>
  )
}

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grp">
    <div className="gl">{label}</div>
    {children}
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
    <div>
      <div className="sh-head">
        <button aria-label="반지 목록으로" onClick={onBack}>‹</button>
        <b>{c.name}</b>
        <span>{c.sub}</span>
      </div>
      <div className="dbody">
        {c.metal && (
          <Group label="색상">
            <Chips opts={METAL} cur={s.METAL} onPick={(v) => set({ METAL: v })} />
          </Group>
        )}
        {c.widths.length >= 2 && (
          <Group label="폭">
            <Chips opts={c.widths.map((w): Opt => [w, c.widthLabels?.[String(w)] ?? `${w}mm`])} cur={s.WMM} onPick={(v) => set({ WMM: v })} />
          </Group>
        )}
        {s.stacked && (
          <Group label="앞 반지와 간격">
            <Chips opts={GAPS} cur={s.GAPMM} onPick={(v) => set({ GAPMM: v })} />
          </Group>
        )}
        {c.rimColor && (
          <Group label="테두리 색">
            <Chips opts={SAME_METAL} cur={s.RMETAL} onPick={(v) => set({ RMETAL: v })} />
          </Group>
        )}
        {paveKeys.length > 0 && (
          <Group label="파베">
            <Chips opts={[['none', '없음'], ...paveKeys.map((k): Opt => [k, c.pave[k]!.label])]} cur={s.PAVE} onPick={(v) => set({ PAVE: v })} />
          </Group>
        )}
        {c.diy && (
          <Group label="두께">
            <Chips opts={[[1.2, '얇게 1.2mm'], [1.8, '보통 1.8mm'], [2.6, '두껍게 2.6mm']]} cur={s.WALL} onPick={(v) => set({ WALL: v })} />
          </Group>
        )}
        {isSol && (
          <>
            <Group label="컷">
              <Chips opts={Object.entries(CUTS).map(([k, o]): Opt => [k, o.n])} cur={s.CUT} onPick={(v) => set({ CUT: v })} />
            </Group>
            {SIX[s.CUT as keyof typeof SIX] && (
              <Group label="발">
                <Chips opts={[[4, '4발'], [6, '6발']]} cur={s.PRONG} onPick={(v) => set({ PRONG: v })} />
              </Group>
            )}
            <Group label="캐럿">
              <Chips opts={[0.3, 0.5, 1, 1.5, 2, 3].map((k): Opt => [k, `${k}ct`])} cur={s.CT} onPick={(v) => set({ CT: v })} />
            </Group>
          </>
        )}
        {(isSol || c.gemPick) && (
          <Group label="알">
            <Chips
              opts={(isSol ? Object.keys(GEMS) : NUDO_GEMS).map((k): Opt => [k, GEMS[k].n])}
              cur={s.GEM}
              onPick={(v) => set({ GEM: v })}
            />
            {solInfo && <div className="solinfo">{solInfo}</div>}
          </Group>
        )}
        <Group label="가드링 (얇은 링 하나 더)">
          <Chips opts={[[0, '없음'], [1, '1.0'], [1.5, '1.5'], [2, '2.0'], [2.5, '2.5mm']]} cur={s.GW} onPick={(v) => set({ GW: v })} />
          {s.GW > 0 && (
            <>
              <Chips opts={[[false, '매끈하게'], [true, '가드링 파베']]} cur={s.GPAVE} onPick={(v) => set({ GPAVE: v })} />
              <Chips opts={SAME_METAL} cur={s.GMETAL} onPick={(v) => set({ GMETAL: v })} />
            </>
          )}
        </Group>
      </div>
      <button className="primary" onClick={onBack}>완료</button>
    </div>
  )
}
