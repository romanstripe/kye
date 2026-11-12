import { useEffect, useRef } from 'react'

export const CameraIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)

// public/landing/ 의 반지 그림 14개: 큰 것(NN_ID.png)과 작은 것(NN_ID_s.png)
const IDS = ['01_SOL', '02_S', '03_MV', '04_ND', '05_B', '06_Q', '07_L', '08_CL', '09_SP', '10_I', '11_BB', '12_MG', '13_PE', '14_CC']
const big = (k: number) => `/landing/${IDS[((k % IDS.length) + IDS.length) % IDS.length]}.png`
const small = (k: number) => `/landing/${IDS[((k % IDS.length) + IDS.length) % IDS.length]}_s.png`

const X = [0, 72, 136, 192, 240], SC = [1, 0.84, 0.72, 0.62, 0.5], OP = [1, 0.85, 0.5, 0.22, 0]

// 처음 화면: 반지가 2.2초마다 한 칸씩 넘어가는 소개 + 내 손으로 시작 / 예시 손으로 둘러보기
export default function Landing({ onFile, onDemo }: { onFile: (f: File) => void; onDemo: () => void }) {
  const file = useRef<HTMLInputElement>(null)
  const bigRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bigEl = bigRef.current!, row = rowRef.current!
    let cur = 0
    let a = document.createElement('img')
    a.alt = ''
    a.src = big(0)
    bigEl.appendChild(a)
    // 아래 동그라미 9칸: 가운데(0)가 지금 반지, 양옆 4칸씩
    const cells: { d: HTMLDivElement; im: HTMLImageElement; o: number }[] = []
    for (let o = -4; o <= 4; o++) {
      const d = document.createElement('div')
      d.className = 'lc'
      const im = document.createElement('img')
      im.alt = ''
      im.src = small(o)
      d.appendChild(im)
      row.appendChild(d)
      cells.push({ d, im, o })
    }
    const lay = () =>
      cells.forEach((c) => {
        const k = Math.min(4, Math.abs(c.o))
        c.d.style.transform = `translateX(${Math.sign(c.o) * X[k]}px) scale(${SC[k]})`
        c.d.style.opacity = String(OP[k])
        c.d.classList.toggle('on', c.o === 0)
      })
    lay()
    const timers: number[] = []
    const step = () => {
      if (document.hidden) return
      cur++
      const b = document.createElement('img')
      b.alt = ''
      b.src = big(cur)
      b.className = 'in'
      bigEl.appendChild(b)
      const old = a
      a = b
      requestAnimationFrame(() => requestAnimationFrame(() => { b.className = ''; old.className = 'out' }))
      timers.push(window.setTimeout(() => old.remove(), 800))
      // 한 칸씩 왼쪽으로. 맨 왼쪽 밖으로 나간 칸은 맨 오른쪽으로 순간이동(jump)
      cells.forEach((c) => {
        c.o--
        if (c.o < -4) { c.o = 4; c.im.src = small(cur + 4); c.d.classList.add('jump') }
      })
      lay()
      requestAnimationFrame(() => cells.forEach((c) => c.d.classList.remove('jump')))
    }
    const id = window.setInterval(step, 2200)
    IDS.forEach((_, k) => { new Image().src = big(k) })
    return () => {
      clearInterval(id)
      timers.forEach(clearTimeout)
      bigEl.replaceChildren()
      row.replaceChildren()
    }
  }, [])

  return (
    <section className="landing" aria-label="환영">
      <div className="lhead">
        <svg width="26" height="26" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="84" r="24" fill="none" stroke="#111" strokeWidth="9" />
          <path transform="translate(0,-8)" d="M28 50 L12 60 L23 46 C25 34 38 26 52 26 C58 18 70 15 78 20 L95 24 L80 30 C82 42 72 52 60 54 L46 54 Z" fill="#111" />
        </svg>
        껴보링
      </div>
      <div className="lstage" aria-hidden="true">
        <div className="lbig" ref={bigRef} />
        <div className="lrow" ref={rowRef} />
      </div>
      <div className="lbot">
        <h1>사기 전에,<br />내 손에 먼저 껴 봐요</h1>
        <p className="lead">손 영상 하나로 반지를 넘겨 보고, 겹쳐 끼고, 호수까지 맞춰 봐요.</p>
        <button className="btn dark" onClick={() => file.current?.click()}>내 손으로 시작하기</button>
        <button className="btn light" onClick={onDemo}>예시 손으로 둘러보기</button>
        <input
          ref={file}
          type="file"
          accept="video/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onFile(f)
          }}
        />
      </div>
    </section>
  )
}
