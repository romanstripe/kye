import { useLayoutEffect, useRef } from 'react'
import type { RingInfo } from './three/stage.ts'

// 반지 휠: 가운데로 오는 카드가 선택됨 (원본 데모 onWheel 과 같은 동작)
export default function Wheel({
  rings,
  thumbs,
  sel,
  onPick,
}: {
  rings: RingInfo[]
  thumbs: Record<string, string>
  sel: string
  onPick: (id: string) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(0)

  const update = () => {
    const w = el.current
    if (!w) return
    const mid = w.getBoundingClientRect().left + w.clientWidth / 2
    let best = -1, bd = 1e9
    Array.from(w.children).forEach((c, i) => {
      const b = c as HTMLElement
      const r = b.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid)
      b.style.transform = `scale(${1 + 0.22 * Math.max(0, 1 - d / 100)})`
      if (d < bd) { bd = d; best = i }
    })
    if (best < 0) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onPick(rings[best].id), 90)
  }

  // 처음 나타날 때(시트를 펼칠 때) 고른 반지를 가운데로
  useLayoutEffect(() => {
    const w = el.current!
    const b = w.children[Math.max(0, rings.findIndex((r) => r.id === sel))] as HTMLElement | undefined
    if (b) w.scrollLeft = b.offsetLeft + b.offsetWidth / 2 - w.clientWidth / 2
    update()
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="wheel" ref={el} onScroll={() => requestAnimationFrame(update)}>
      {rings.map((c) => (
        <button
          key={c.id}
          type="button"
          className="card"
          aria-label={`${c.name}, ${c.sub}`}
          aria-current={c.id === sel}
          onClick={(e) => {
            e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            onPick(c.id)
          }}
        >
          <img alt="" src={thumbs[c.id]} />
          <span className="n">{c.name}</span>
        </button>
      ))}
    </div>
  )
}
