import { useEffect, useRef, useState } from 'react'
import { HAND_FILL, HAND_LINE, HAND_POINTS } from './analyzingHand.ts'

// 분석 화면. reference_analyzing/analyzing.html 을 React 로 옮긴 것 (모양·동작은 그대로).
// target = 실제 진행 단계: 0 손 찾는 중 → 1 굵기 재는 중 → 2 반지 자리 잡는 중 → 3 끝.
// 화면이 휙 지나가지 않도록 단계마다 최소 시간은 보여주고, 다 끝나면 1초 뒤 onFinish.
const MIN = [1400, 1600, 1200]
const L = HAND_POINTS
const CH = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]]   // 뼈 선 (손목→손가락 끝, 손바닥 가로줄)
const ORDER = [0, 1, 5, 9, 13, 17, 2, 6, 10, 14, 18, 3, 7, 11, 15, 19, 4, 8, 12, 16, 20]   // 점이 찍히는 차례
const BARS: [number, number][] = [[5, 6], [9, 10], [13, 14], [17, 18]]   // 손가락 굵기 막대 (약지만 노란색)
const BAR_H: Record<number, number> = { 5: 17, 9: 17, 13: 15, 17: 13 }
const STEPS = ['손을 찾고 있어요', '손가락 굵기를 재고 있어요', '반지 자리를 잡고 있어요']
const PROG = [18, 52, 82, 100]

export default function Analyzing({ target, error, onBack, onFinish }: { target: number; error?: string; onBack: () => void; onFinish: () => void }) {
  const [shown, setShown] = useState(0)
  const [on, setOn] = useState(false)   // 점이 톡톡 나타나는 애니메이션 시작
  const since = useRef(performance.now())
  const fin = useRef(onFinish)
  fin.current = onFinish

  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(r)
  }, [])

  useEffect(() => {
    if (error) return
    if (shown < target) {
      const t = setTimeout(() => { since.current = performance.now(); setShown(shown + 1) }, Math.max(0, MIN[shown] - (performance.now() - since.current)))
      return () => clearTimeout(t)
    }
    if (shown === 3) {
      const t = setTimeout(() => fin.current(), 1000)
      return () => clearTimeout(t)
    }
  }, [shown, target, error])

  const done = shown === 3
  const cls = `an${error ? ' err' : done ? ' done' : ` s${shown}`}`
  const delay = (ms: number) => ({ transitionDelay: `${ms}ms` })

  return (
    <section className={cls} aria-live="polite" aria-label="손 분석">
      <div className="an-top">
        <svg width="24" height="24" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="84" r="24" fill="none" stroke="#111" strokeWidth="9" />
          <path transform="translate(0,-8)" d="M28 50 L12 60 L23 46 C25 34 38 26 52 26 C58 18 70 15 78 20 L95 24 L80 30 C82 42 72 52 60 54 L46 54 Z" fill="#111" />
        </svg>
        껴보링
      </div>
      <div className="an-stage" aria-hidden="true">
        <svg viewBox="-15 125 480 620" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="an-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFD25A" stopOpacity="0" />
              <stop offset=".5" stopColor="#FFD25A" stopOpacity=".22" />
              <stop offset=".53" stopColor="#FFD25A" stopOpacity=".75" />
              <stop offset=".56" stopColor="#FFD25A" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g>
            <path d={HAND_FILL} fill="#fff" />
            <path d={HAND_LINE} fill="none" stroke="#2a2a2e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          <g className="scan"><rect x="-50" y="0" width="600" height="160" fill="url(#an-g)" /></g>
          <g>
            {CH.flatMap((ch, ci) => ch.slice(0, -1).map((a, j) => {
              const p = L[a], q = L[ch[j + 1]]
              return <path key={`${ci}-${j}`} className={`bone${shown >= 1 ? ' on' : ''}`} d={`M${p[0]} ${p[1]}L${q[0]} ${q[1]}`}
                style={{ ['--l' as string]: Math.hypot(q[0] - p[0], q[1] - p[1]), ...delay(ci * 90 + j * 60) }} />
            }))}
          </g>
          <g>
            {BARS.map(([a, b], n) => {
              const A = L[a], B = L[b], dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy), px = -dy / d, py = dx / d
              const cx = A[0] + dx * 0.6, cy = A[1] + dy * 0.6, h = BAR_H[a], ring = a === 13
              return (
                <g key={a}>
                  <line x1={cx - px * h} y1={cy - py * h} x2={cx + px * h} y2={cy + py * h} className={`bar${ring ? ' ring' : ''}${shown >= 1 ? ' on' : ''}`} style={delay(450 + n * 140)} />
                  {ring && <circle cx={cx} cy={cy} r={h * 1.1} className="halo" />}
                </g>
              )
            })}
          </g>
          <g>
            {ORDER.map((i, n) => <circle key={i} cx={L[i][0]} cy={L[i][1]} r={i % 4 === 0 && i ? 4.5 : 3.6} className={`dot${on ? ' on' : ''}`} style={delay(80 + n * 45)} />)}
          </g>
        </svg>
      </div>
      <div className="an-card">
        {error ? (
          <>
            <h1>{error}</h1>
            <p>손이 화면 안에 잘 보이게 다시 찍어 주세요.</p>
            <button className="an-btn" onClick={onBack}>다시 찍기</button>
          </>
        ) : (
          <>
            <h1>{done ? '다 됐어요!' : '손을 분석하고 있어요'}</h1>
            <p>{done ? '이제 반지를 골라 껴 봐요.' : '잠깐이면 돼요.'}</p>
            <div className="an-prog"><i style={{ width: `${PROG[shown]}%` }} /></div>
            <ol className="an-steps">
              {STEPS.map((t, i) => (
                <li key={t} className={i < shown ? 'ok' : i === shown ? 'cur' : ''}><span className="ic" />{t}</li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  )
}
