import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { RingInfo } from './three/stage.ts'
import { FINGERS, FINGER_NAME } from './hand/width.ts'
import type { Finger } from './hand/width.ts'

export type Slot = { id: string; active: boolean; finger: string }   // 끼운 반지 하나

// 끼운 반지 목록 (위 줄의 "반지 세트"를 누르면 왼쪽에 펼쳐짐). 지금 손가락의 층만 보여주고 위쪽이 손톱 쪽
export default function WornPanel({
  open, slots, rings, thumbs, pick, ignore,
  onClose, onSwitch, onRemove, onTogglePick,
}: {
  open: boolean
  slots: Slot[]
  rings: RingInfo[]
  thumbs: Record<string, string>
  pick: boolean   // 손가락 고르는 중
  ignore: RefObject<HTMLElement | null>   // 이 버튼(반지 세트)을 누른 건 바깥 누름으로 치지 않음
  onClose: () => void
  onSwitch: (i: number) => void
  onRemove: (i: number) => void
  onTogglePick: () => void
}) {
  const root = useRef<HTMLDivElement>(null)

  // 바깥을 누르면 닫힘 (손가락 고르는 중에는 닫지 않음)
  useEffect(() => {
    if (!open || pick) return
    const close = (e: PointerEvent) => {
      const t = e.target as Node
      if (!root.current?.contains(t) && !ignore.current?.contains(t)) onClose()
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pick])

  const act = slots.find((s) => s.active)
  const used = FINGERS.filter((f) => slots.some((s) => s.finger === f))
  const withIndex = slots.map((sl, i) => ({ ...sl, i }))
  const layers = withIndex.filter((s) => s.finger === (act?.finger ?? 'ring')).reverse()

  return (
    <div ref={root} id="worn" className={`stack${open ? ' open' : ''}`} aria-label="끼운 반지 (위가 손톱 쪽)">
      {used.length > 1 && (
        <div className="fsw">
          {used.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={f === act?.finger}
              onClick={() => {
                const l = withIndex.filter((s) => s.finger === f)
                onSwitch(l[l.length - 1].i)
              }}
            >
              {FINGER_NAME[f]}
            </button>
          ))}
        </div>
      )}
      {slots.length < 8 && (
        <button type="button" className="addl" aria-label="반지 하나 더 끼기" aria-pressed={pick} onClick={onTogglePick}>
          ＋
        </button>
      )}
      {layers.map(({ id, active: on, i, finger }) => {
        const name = rings.find((r) => r.id === id)?.name ?? id
        return (
          <button key={i} type="button" className="lay" aria-pressed={on} aria-label={`${FINGER_NAME[finger as Finger]} ${name}`} onClick={() => onSwitch(i)}>
            <img alt="" src={thumbs[id] ?? ''} />
            {on && slots.length > 1 && (
              <span
                className="x"
                role="button"
                aria-label="이 반지 빼기"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(i)
                }}
              >
                ✕
              </span>
            )}
          </button>
        )
      })}
      {used.length === 1 && used[0] !== 'ring' && <span className="lbl">{FINGER_NAME[used[0]]}</span>}
    </div>
  )
}
