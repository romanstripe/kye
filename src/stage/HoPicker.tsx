import { useEffect, useRef, useState } from 'react'

// 내 호수 5~25호, 0.5 단위
const HOS = Array.from({ length: 41 }, (_, i) => 5 + i * 0.5)

// 위 줄의 "내 호수" 버튼과 작은 목록. 열 때 고른 호수가 가운데 오게, 바깥을 누르면 닫힘
export default function HoPicker({ value: ho, onChange }: { value: number; onChange: (ho: number) => void }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const on = pop.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (on && pop.current) pop.current.scrollTop = on.offsetTop - pop.current.clientHeight / 2 + 18
    const close = (e: PointerEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <>
      <button ref={btn} type="button" className="chip pick" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>내 호수</span> <b>{ho}호</b>
      </button>
      {open && (
        <div
          ref={pop}
          className="hopop"
          role="listbox"
          aria-label="내 반지 호수"
          style={{ top: (btn.current?.getBoundingClientRect().bottom ?? 0) + 6, left: btn.current?.getBoundingClientRect().left ?? 0 }}
        >
          {HOS.map((v) => (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={v === ho}
              onClick={() => {
                onChange(v)
                setOpen(false)
              }}
            >
              {v}호
            </button>
          ))}
        </div>
      )}
    </>
  )
}
