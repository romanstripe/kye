import { useEffect, useRef, useState } from 'react'
import { FRAME_COUNT, newFrameCanvas, drawCover, warmup } from './hand/analyze.ts'

const SECONDS = 3
const IS_TOSS = new URLSearchParams(location.search).has('toss')   // ?toss 일 때만: 웹뷰가 카메라를 인라인으로 못 띄우면 토스 SDK 사진 촬영으로 대체

// 페이지 안에서 바로 카메라를 켜고 3초 동안 FRAME_COUNT장을 뽑음 (영상 파일을 거치지 않아 압축 손실 없음)
// 끝까지 다 찍었을 때만 onDone. 취소·뒤로가기·전체화면 종료·화면 숨김·카메라 끊김으로 끊기면 찍던 것은 버리고 촬영 전 화면으로
export default function LiveCapture({ onDone, onClose }: { onDone: (frames: Blob[]) => void; onClose: () => void }) {
  const vid = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef(0)
  const run = useRef(0)   // 촬영 번호: 중단되면 올라가서, 늦게 끝난 이전 촬영 결과를 버림
  const recording = useRef(false)
  const photoing = useRef(false)   // 토스 사진 촬영으로 넘어갔는지
  const cvs = useRef<HTMLCanvasElement | null>(null)   // 찍는 중 쓰는 큰 캔버스 (버릴 때 메모리 반납)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')   // 촬영이 중단됐다는 안내
  const [n, setN] = useState<number | null>(null) // 찍은 장수 (null = 촬영 전)

  // 찍던 것(반복·캔버스)을 정리. run 을 올려서 늦게 끝난 이전 촬영 결과도 버림
  const stopLoop = () => {
    clearInterval(timer.current)
    recording.current = false
    run.current++
    if (cvs.current) cvs.current.width = cvs.current.height = 0
    cvs.current = null
  }
  // 이전 스트림의 트랙을 전부 끄고 video 를 비움
  const stopStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    const v = vid.current
    if (v) {
      v.pause()
      v.srcObject = null
    }
  }
  // 찍던 것을 버리고 촬영 전 화면으로
  const discard = (msg: string) => {
    if (!recording.current) return
    stopLoop()
    setN(null)
    setNote(msg)
  }
  const close = () => {
    stopLoop()
    stopStream()
    onClose()
  }
  // 재생이 막히면 몇 번 다시 시도 (iOS 웹뷰는 처음 한두 번 실패하기도 함). 끝내 안 되면 false
  const playRetry = async (v: HTMLVideoElement, s: MediaStream) => {
    for (let i = 0; i < 4; i++) {
      if (stream.current !== s) return true   // 그 사이 스트림이 바뀌었으면 더 시도하지 않음
      try {
        await v.play()
        return true
      } catch {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)))
      }
    }
    return false
  }

  // 토스 SDK 로 사진 한 장 찍기 → 같은 사진을 FRAME_COUNT장으로 (움직임 없는 손). ?toss 에서만
  const takePhoto = async () => {
    if (!IS_TOSS || photoing.current) return
    photoing.current = true
    stopLoop()
    stopStream()
    setNote('사진을 한 장 찍어 주세요')
    try {
      const { openCamera } = await import('@apps-in-toss/web-framework')
      const r = await openCamera({ base64: true, maxWidth: 1920 })
      const bmp = await createImageBitmap(await (await fetch(r.dataUri)).blob())
      const c = newFrameCanvas()
      drawCover(c, bmp, bmp.width, bmp.height)
      bmp.close()
      const jpg = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.92))
      c.width = c.height = 0
      if (!jpg) throw new Error('jpg')
      onDone(Array.from({ length: FRAME_COUNT }, () => jpg))
    } catch {
      setErr('사진을 찍지 못했어요. 다시 시도해 주세요')
    }
  }

  const openStream = (): Promise<void> => {
    stopStream()   // 다시 켤 때 이전 스트림이 남아 있지 않게
    return navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 4096 } } })   // 소리 없이 영상만
      .then((s) => {
        stream.current = s
        const v = vid.current!
        // iOS 웹뷰가 전체화면 플레이어로 띄우지 않게: 속성을 JSX 와 DOM 에 모두 넣고, 그 다음에 play()
        v.setAttribute('playsinline', '')
        v.setAttribute('webkit-playsinline', '')
        v.setAttribute('muted', '')
        v.setAttribute('autoplay', '')
        v.setAttribute('x-webkit-airplay', 'allow')
        v.muted = true
        v.playsInline = true
        v.srcObject = s
        s.getTracks().forEach((t) =>
          t.addEventListener('ended', () => {   // 카메라 연결이 끊김
            if (stream.current !== s) return
            discard('카메라 연결이 끊겼어요. 다시 찍어 주세요')
            stopStream()
            if (!photoing.current) openStream().catch(() => setErr('카메라를 켤 수 없어요. 카메라 권한을 허용해 주세요'))
          }),
        )
        playRetry(v, s).then((ok) => { if (!ok) takePhoto() })   // 몇 번 다시 해도 인라인 재생이 막히면 (토스에서만) 사진 촬영으로
        setTimeout(() => {   // 1.5초 뒤에도 영상이 안 나오거나 전체화면 플레이어가 떠 있으면 같은 대체
          if (stream.current === s && (v.paused || !v.videoWidth || (v as any).webkitDisplayingFullscreen)) takePhoto()
        }, 1500)
      })
  }

  useEffect(() => {
    let dead = false
    warmup()
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('이 브라우저에서는 카메라를 켤 수 없어요 (https 주소에서만 돼요)')
      return
    }
    openStream().catch(() => !dead && setErr('카메라를 켤 수 없어요. 카메라 권한을 허용해 주세요'))

    // 뒤로가기: 찍는 중이면 찍던 것을 버리고 촬영 전 화면으로, 아니면 카메라를 닫음
    history.pushState({ live: 1 }, '')
    const onPop = () => {
      if (recording.current) {
        history.pushState({ live: 1 }, '')
        discard('뒤로 가서 촬영을 멈췄어요. 다시 찍어 주세요')
      } else onClose()
    }
    const onHide = () => document.hidden && discard('화면이 바뀌어 촬영을 멈췄어요. 다시 찍어 주세요')
    const v = vid.current!
    const onEndFs = () => discard('전체화면이 닫혀 촬영을 멈췄어요. 다시 찍어 주세요')   // iOS 전체화면 플레이어 종료
    const onBeginFs = () => takePhoto()   // iOS 가 전체화면 플레이어로 띄움
    addEventListener('popstate', onPop)
    document.addEventListener('visibilitychange', onHide)
    v.addEventListener('webkitendfullscreen', onEndFs)
    v.addEventListener('webkitbeginfullscreen', onBeginFs)
    return () => {
      dead = true
      removeEventListener('popstate', onPop)
      document.removeEventListener('visibilitychange', onHide)
      v.removeEventListener('webkitendfullscreen', onEndFs)
      v.removeEventListener('webkitbeginfullscreen', onBeginFs)
      stopLoop()
      stopStream()
      if (history.state?.live) history.back()   // 우리가 쌓아 둔 기록 한 칸을 치움
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = () => {
    const v = vid.current
    if (!v || !v.videoWidth || n !== null) return
    const my = ++run.current
    recording.current = true
    setNote('')
    const c = newFrameCanvas()
    cvs.current = c
    const jobs: Promise<Blob | null>[] = []
    setN(0)
    timer.current = window.setInterval(() => {
      if (my !== run.current) return clearInterval(timer.current)
      drawCover(c, v, v.videoWidth, v.videoHeight)
      jobs.push(new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))) // toBlob은 부른 순간의 화면을 담아서 캔버스를 다시 써도 안전
      setN(jobs.length)
      if (jobs.length < FRAME_COUNT) return
      clearInterval(timer.current)
      Promise.all(jobs).then((bl) => {
        if (my !== run.current) return   // 그 사이 중단됐으면 버림
        if (bl.some((b) => !b)) { stopLoop(); return setErr('사진을 만들지 못했어요. 다시 찍어 주세요') }
        stopLoop()   // 다 찍어서 끝남 → 카메라를 끄고 이 프레임들만 넘김 (완료된 촬영만 업로드)
        stopStream()
        onDone(bl as Blob[])
      })
    }, (SECONDS * 1000) / FRAME_COUNT)
  }

  return (
    <div className="live" role="dialog" aria-label="카메라">
      <video ref={vid} playsInline webkit-playsinline="true" x-webkit-airplay="allow" muted autoPlay />
      <button className="live-x" aria-label="닫기" onClick={close}>✕</button>
      {n !== null && !err && <div className="live-tip" role="status">손을 벌리고 천천히 돌릴수록<br />시뮬레이션이 안정적이에요</div>}
      <div className="live-bot">
        {err ? (
          <>
            <span className="note">{err}</span>
            <button className="live-btn" onClick={close}>돌아가기</button>
          </>
        ) : (
          <>
            <span className="note">{n !== null ? `촬영 중 ${n}/${FRAME_COUNT}` : note || `손을 화면에 맞추고 버튼을 누르면 ${SECONDS}초 동안 찍어요`}</span>
            <button className="live-btn" disabled={n !== null} onClick={start}>
              {n === null ? '촬영 시작' : '찍는 중…'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
