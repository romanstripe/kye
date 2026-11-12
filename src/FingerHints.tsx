const IW = 480
const IH = 854

export type Hint = { f: string; name: string; x: number; y: number }   // x, y: 480×854 화면 기준 px

// 손가락 고르기: 손가락마다 반지 자리에 ＋ 점. 누르면 그 손가락에 반지를 하나 더 끼움
export default function FingerHints({ hints, onPick }: { hints: Hint[]; onPick: (finger: string) => void }) {
  return (
    <div className="hints">
      {hints.map((h) => (
        <button
          key={h.f}
          type="button"
          className="hint"
          aria-label={`${h.name}에 끼기`}
          style={{ left: `${(h.x / IW) * 100}%`, top: `${(h.y / IH) * 100}%` }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onPick(h.f)}
        >
          ＋<span>{h.name}</span>
        </button>
      ))}
    </div>
  )
}
