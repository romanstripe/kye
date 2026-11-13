// 반지 세트 저장 (서버/DB 없이 localStorage 만). 키 "kyeoboring.sets.v1"
// 저장은 그 순간의 스냅샷을 복사해 새 항목으로 추가. 지금 세트를 고쳐도 저장본은 안 바뀜.
import type { RingInfo } from './three/stage.ts'
import { FINGERS, FINGER_NAME } from './hand/width.ts'
import type { Finger } from './hand/width.ts'

export const SETS_KEY = 'kyeoboring.sets.v1'

// 반지 하나. ringId 는 rings.json 의 id (이름과 달리 절대 안 바뀜). opt = 위 칸에 없는 나머지 옵션(간격·두께·테두리 색·알 등)이라 그대로 복원할 수 있음
export type SavedRing = { finger: string; ringId: string; color: string | null; width: number; pave: string; guard: number; order: number; opt?: Record<string, unknown> }
export type SavedSet = { v: 1; id: string; savedAt: number; ringSize: number; rings: SavedRing[] }
export type Snapshot = { ringSize: number; rings: SavedRing[] }

export const METAL_NAME: Record<string, string> = { PG: '로즈골드', YG: '옐로골드', WG: '화이트골드' }

const isSet = (x: any): x is SavedSet =>
  !!x && x.v === 1 && typeof x.id === 'string' && typeof x.savedAt === 'number' && typeof x.ringSize === 'number' && Array.isArray(x.rings) && x.rings.length > 0 &&
  x.rings.every((r: any) => r && typeof r.ringId === 'string' && typeof r.finger === 'string')

function readRaw(): any[] {
  try {
    const a = JSON.parse(localStorage.getItem(SETS_KEY) ?? '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}
// 최신이 위로. 형식(v)이 다른 항목은 무시
export const loadSets = (): SavedSet[] => readRaw().filter(isSet).sort((a, b) => b.savedAt - a.savedAt)

// 형식이 다른 항목은 건드리지 않고 그대로 남겨 둠 (무시할 뿐 지우지는 않음)
function write(sets: SavedSet[]) {
  try {
    localStorage.setItem(SETS_KEY, JSON.stringify([...readRaw().filter((x) => !isSet(x)), ...sets]))
  } catch {
    /* 저장 공간이 없거나 막혀 있으면 조용히 포기 */
  }
}

// 같은 구성인지 비교하는 값 (호수 + 반지들의 순서·옵션). id·시각은 뺌
export const sigOf = (s: Snapshot) =>
  `${s.ringSize}#` + [...s.rings].sort((a, b) => a.order - b.order).map((r) => [r.finger, r.ringId, r.color, r.width, r.pave, r.guard, JSON.stringify(r.opt ?? {})].join('|')).join('/')

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)

// 담기: 같은 구성이 이미 있으면 새로 만들지 않음 (added=false)
export function addSet(snap: Snapshot): { sets: SavedSet[]; added: boolean } {
  const sets = loadSets()
  if (sets.some((s) => sigOf(s) === sigOf(snap))) return { sets, added: false }
  const item: SavedSet = { v: 1, id: newId(), savedAt: Date.now(), ringSize: snap.ringSize, rings: JSON.parse(JSON.stringify(snap.rings)) }
  const next = [item, ...sets]
  write(next)
  return { sets: next, added: true }
}

export function removeSet(id: string): SavedSet[] {
  const next = loadSets().filter((s) => s.id !== id)
  write(next)
  return next
}

// 목록 한 줄에 쓸 글자: 제목(반지 이름들, 같은 반지는 한 번만 + 개수), 설명(손가락, 색). 없는 ringId 는 건너뜀
export function describe(set: SavedSet, rings: RingInfo[]) {
  const sorted = [...set.rings].sort((a, b) => a.order - b.order)
  const known = sorted.filter((r) => rings.some((c) => c.id === r.ringId))
  const kinds: { id: string; name: string; n: number }[] = []
  known.forEach((r) => {
    const k = kinds.find((x) => x.id === r.ringId)
    if (k) k.n++
    else kinds.push({ id: r.ringId, name: rings.find((c) => c.id === r.ringId)!.name, n: 1 })
  })
  const titleParts = kinds.map((k) => (k.n > 1 ? `${k.name} ${k.n}개` : k.name))
  const fingers = FINGERS.filter((f) => known.some((r) => r.finger === f)).map((f) => {
    const n = known.filter((r) => r.finger === f).length
    return n > 1 ? `${FINGER_NAME[f as Finger]} ${n}개` : FINGER_NAME[f as Finger]
  })
  const colors = [...new Set(known.map((r) => r.color).filter((c): c is string => !!c))].map((c) => METAL_NAME[c] ?? c)
  return { kinds, titleParts, desc: [...fingers, ...colors].join(', ') }
}
