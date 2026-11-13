import { useEffect, useRef, useState } from 'react'
import { FRAME_COUNT, newFrameCanvas, drawCover, warmup } from './hand/analyze.ts'

const SECONDS = 3

// 페이지 안에서 바로 카메라를 켜고 3초 동안 FRAME_COUNT장을 뽑음 (영상 파일을 거치지 않아 압축 손실 없음)
export default function LiveCapture({ onDone, onClose }: { onDone: (frames: Blob[]) => void; onClose: () => void }) {
  const vid = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef(0)
  const [err, setErr] = useState('')
  const [n, setN] = useState<number | null>(null) // 찍은 장수 (null = 촬영 전)

  useEffect(() => {
    let dead = false
    warmup()
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('이 브라우저에서는 카메라를 켤 수 없어요 (https 주소에서만 돼요)')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 4096 } } })
      .then((s) => {
        if (dead) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        const v = vid.current!
        v.srcObject = s
        v.play().catch(() => {})
      })
      .catch(() => !dead && setErr('카메라를 켤 수 없어요. 카메라 권한을 허용해 주세요'))
    return () => {
      dead = true
      clearInterval(timer.current)
      stream.current?.getTracks().forEach((t) => t.stop())
      stream.current = null
    }
  }, [])

  const start = () => {
    const v = vid.current
    if (!v || !v.videoWidth || n !== null) return
    const c = newFrameCanvas()
    const jobs: Promise<Blob | null>[] = []
    setN(0)
    timer.current = window.setInterval(() => {
      drawCover(c, v, v.videoWidth, v.videoHeight)
      jobs.push(new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))) // toBlob은 부른 순간의 화면을 담아서 캔버스를 다시 써도 안전
      setN(jobs.length)
      if (jobs.length < FRAME_COUNT) return
      clearInterval(timer.current)
      Promise.all(jobs).then((bl) => {
        if (bl.some((b) => !b)) return setErr('사진을 만들지 못했어요. 다시 찍어 주세요')
        stream.current?.getTracks().forEach((t) => t.stop())
        onDone(bl as Blob[])
      })
    }, (SECONDS * 1000) / FRAME_COUNT)
  }

  return (
    <div className="live" role="dialog" aria-label="카메라">
      <video ref={vid} playsInline muted autoPlay />
      <button className="live-x" aria-label="닫기" onClick={onClose}>✕</button>
      {n !== null && !err && <div className="live-tip" role="status">손을 벌리고 천천히 돌릴수록<br />시뮬레이션이 안정적이에요</div>}
      <div className="live-bot">
        {err ? (
          <>
            <span className="note">{err}</span>
            <button className="live-btn" onClick={onClose}>돌아가기</button>
          </>
        ) : (
          <>
            <span className="note">{n === null ? `손을 화면에 맞추고 버튼을 누르면 ${SECONDS}초 동안 찍어요` : `촬영 중 ${n}/${FRAME_COUNT}`}</span>
            <button className="live-btn" disabled={n !== null} onClick={start}>
              {n === null ? '촬영 시작' : '찍는 중…'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
