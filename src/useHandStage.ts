import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createStage } from './three/stage.ts'
import type { RingInfo, HandData } from './three/types.ts'
import { analyzeVideo, analyzeFrames, revokeHand } from './hand/analyze.ts'
import type { Hint } from './FingerHints.tsx'
import type { Slot } from './WornPanel.tsx'
import type { Menu } from './HandStage.tsx'

type Els = {
  img: RefObject<HTMLImageElement | null>
  shadow: RefObject<HTMLCanvasElement | null>
  out: RefObject<HTMLCanvasElement | null>
  debug: RefObject<HTMLCanvasElement | null>
}

// 무대(three/stage.ts)를 만들고 손 분석·교체를 맡음. 무대가 알려 주는 값(굵기 재기 단계, 호수, 슬롯, 손가락 점 등)을 상태로 들고 있음
export function useHandStage({ els, initialFile, onReady, onActiveRing, debug0 }: {
  els: Els
  initialFile: File | Blob[]
  onReady: (m: Menu) => void
  onActiveRing?: (id: string) => void
  debug0: number
}) {
  const [ho, setHo] = useState(10)   // 내 호수 (세트를 복원하면 저장된 호수로 바뀜)
  const [an, setAn] = useState(0)   // 분석 화면의 진행 단계 (0 손 찾기, 1 굵기 재기, 3 끝)
  const [anFail, setAnFail] = useState('')
  const [info, setInfo] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])   // 끼운 반지들
  const [hints, setHints] = useState<Hint[]>([])   // 손가락마다 ＋ 점 자리(px)
  const [busy, setBusy] = useState<number | null>(null) // 처리한 프레임 수
  const [busyText, setBusyText] = useState('')
  const [msg, setMsg] = useState('')
  const stageRef = useRef<ReturnType<typeof createStage> | null>(null)
  const mine = useRef<HandData | null>(null)
  const ringsRef = useRef<RingInfo[]>([])
  const active = useRef(onActiveRing)
  active.current = onActiveRing
  const ready = useRef(onReady)
  ready.current = onReady

  useEffect(() => {
    let stage: ReturnType<typeof createStage> | null = null
    let dead = false
    // 반지 목록과 손 분석을 같이 시작. 손이 준비돼야 무대를 만듦
    Promise.all([
      fetch('/rings.json').then((r) => r.json() as Promise<{ rings: RingInfo[] }>).then((j) => j.rings),
      (Array.isArray(initialFile) ? analyzeFrames : analyzeVideo)(initialFile as never, () => {}),
    ]).then(([rings, hand]) => {
      if (dead) return revokeHand(hand)
      mine.current = hand
      ringsRef.current = rings
      setAn(1)   // 손 찾기 끝 → 손가락 굵기 재는 중 (무대가 뒤에서 굵기를 재고, 끝나면 onMeasured)
      stage = stageRef.current = createStage(
        { img: els.img.current!, shadow: els.shadow.current!, out: els.out.current!, debug: els.debug.current!, onInfo: setInfo, onMeasured: () => setAn(3), onHo: setHo, onHints: setHints, onSlots: (l) => { setSlots(l); const a = l.find((x) => x.active); if (a) active.current?.(a.id) } },
        rings,
        hand,
      )
      if (debug0 > 0) stage.setDebug(debug0)
      ready.current({ rings, thumbs: stage.thumbs, pick: stage.pick, state: stage.state, set: stage.set, restore: stage.restore, initial: rings[0].id })
    }).catch((e) => !dead && setAnFail(e instanceof Error ? e.message : '분석에 실패했어요'))
    return () => {
      dead = true
      stage?.stop()
      stageRef.current = null
      if (mine.current) revokeHand(mine.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 새 손 영상(파일 또는 촬영한 프레임)으로 교체
  const loadHand = async (f: File | Blob[] | undefined) => {
    if (!f || !stageRef.current) return
    setMsg('')
    setBusy(0)
    try {
      const hand = await (Array.isArray(f) ? analyzeFrames : analyzeVideo)(f as never, (n, _t, st) => (setBusy(n), st && setBusyText(st)))
      const old = mine.current
      mine.current = hand
      stageRef.current?.setHand(hand)
      if (old) revokeHand(old)
    } catch (e) {
      // 손을 못 찾거나 영상이 이상하면 안내만 하고 화면은 그대로
      setMsg(`${e instanceof Error ? e.message : '분석에 실패했어요'}. 카메라 버튼으로 다시 찍어 주세요`)
      setTimeout(() => setMsg(''), 6000)
    } finally {
      setBusy(null)
    }
  }

  return { stageRef, ringsRef, ho, setHo, an, anFail, info, slots, hints, busy, busyText, msg, loadHand }
}
