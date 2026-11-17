import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { sigOf } from './sets.ts'
import type { SavedSet, Snapshot } from './sets.ts'

// 반지 세트 담기: 지금 세트가 이미 저장돼 있는지(하트가 꽉 참) / 담기 / "세트를 담았어요" 알림.
// 같은 구성이 이미 있으면 새로 만들지 않고(onSaveSet 이 false) 하트만 꽉 찬 채로 둠
export function useSaveSet(stageRef: RefObject<{ snapshot: () => Snapshot } | null>, sets: SavedSet[], onSaveSet: (s: Snapshot) => boolean) {
  const [toast, setToast] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const snap = stageRef.current?.snapshot()
  const saved = !!snap && sets.some((s) => sigOf(s) === sigOf(snap))
  const save = () => {
    const s = stageRef.current?.snapshot()
    if (!s || !onSaveSet(s)) return
    setToast(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(false), 3500)
  }
  return { saved, save, toast, hideToast: () => setToast(false) }
}
