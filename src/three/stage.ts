// @ts-nocheck  (조명·배치·합성·반짝임)
import * as THREE from 'three'
import { S, H, TAU, IW, IH, LI, cv, renderer, mainScene, cam, clip } from './shared.ts'
import { NUDO_GEMS, makeHead } from './sol.ts'
import { makeRing, TW } from './makeRing.ts'
import { layoutStones } from './layoutStones.ts'
import { skinMask } from '../hand/skin.ts'
import type { SkinMask } from '../hand/skin.ts'
import { makeSlider, makeNudo } from './heads.ts'
import { STORE_ENV } from './lights.ts'
import { SEGS, occ, JI, occJ } from './occluders.ts'
import { measure, median, FINGERS, FINGER_NAME, JOINT } from '../hand/width.ts'
import { drawHandDebug } from './debugDraw.ts'
import { smoothLandmarks } from '../hand/smooth.ts'

// public/rings.json 의 반지 한 개. pave.*.byWidth[폭] = layoutStones 에 넘기는 설정
type PaveOpt = { label: string; byWidth: Record<string, any> }
export type RingInfo = {
  id: string; name: string; sub: string; widths: number[]; widthLabels?: Record<string, string>; defaultWidth: number
  wall: number; metal: string | null; diy: boolean; rimColor: boolean; gemPick: boolean; gem: string | null
  pave: Partial<Record<'semi' | 'alt' | 'full' | 'both', PaveOpt>>
}
// frames: 프레임 이미지 주소, P/LMS: 프레임별 손 좌표, pmin~pmax: 왕복 재생할 구간
export type HandData = { N: number; P: (number[] | null)[]; LMS: number[][][]; frames: string[]; pmin: number; pmax: number; custom?: boolean }
type StageEls = { img: HTMLImageElement; shadow: HTMLCanvasElement; out: HTMLCanvasElement; debug?: HTMLCanvasElement; onInfo?: (s: string) => void; onSlots?: (list: { id: string; active: boolean; finger: string }[]) => void; onHints?: (list: { f: string; name: string; x: number; y: number }[]) => void }



export function createStage(els: StageEls, CAT: RingInfo[], hand: HandData) {
  const { img, shadow: sh, out: outc } = els
  clip.set(new THREE.Vector3(0, 0, 1), 1000)   // 재질에 달린 잘라내기 평면은 멀리 둠 (손가락별 평면은 renderMain 에서)
  const sx2 = sh.getContext('2d'), ox = outc.getContext('2d')
  let N = 0, P = [], LMS = [], SM = [], frames = [], PMIN = 0, PMAX = 0, cur = 0
  let AUTO = true, zoom = false, zc = [240, 400]   // 자동 재생 / 가까이 보기 / 확대 중심

  // 가까이: 반지 자리를 2.6배 확대해서 보여줌 (손 사진·반지 캔버스를 같이 키움)
  const zw = img.parentElement, box = zw.parentElement
  function applyZoom() {
    const Z = 2.6, k = box.clientWidth / IW
    if (!zoom) { zw.style.transform = 'none'; return }
    const tx = Math.min(0, Math.max(box.clientWidth * (1 - Z), box.clientWidth / 2 - zc[0] * k * Z)), ty = Math.min(0, Math.max(box.clientHeight * (1 - Z), box.clientHeight / 2 - zc[1] * k * Z))
    zw.style.transform = `translate(${tx}px,${ty}px) scale(${Z})`
  }
  addEventListener('resize', applyZoom)
  let playDir = -1, lastPlay = 0, resumeAt = 0, dragX = null, dragY = 0, drag0 = 0
  function setHand(h) {
    N = h.N; P = h.P; LMS = h.LMS; SM = smoothLandmarks(LMS); frames = h.frames; PMIN = h.pmin; PMAX = h.pmax
    // 내가 올린 영상은 예시 손에 맞춰 잡은 보정(손등 기울기, 옆 이동, 옆 조임)을 끔
    T = h.custom ? MINE : DEMO; fixed = null
    frames.forEach(u => { new Image().src = u })   // 미리 받아두기
    cur = PMAX; playDir = -1; resumeAt = 0; dragX = null
    masks.clear(); meas.clear(); fingerMemo = null; inflight.clear(); warmId++; warm(); report()   // 손 영상을 불러오면 재생 구간의 다섯 손가락 폭을 미리 재 둠 (끝나면 다시 재지 않음)
  }


  function ringWall() { const c = CAT[S.CI]; return c.diy ? S.WALL : c.wall }
  function dispose(g) { if (!g) return; S.scene.remove(g); S.scene.remove(g.userData.stones) }
  function rebuild() {
    dispose(S.ring); dispose(S.ring2); if (S.head) { S.scene.remove(S.head); S.head = null }
    const c = CAT[S.CI]; S.ring = makeRing(c.id, ringWall(), S.METAL, S.WMM)
    if (c.id === 'SOL') S.head = makeHead(Math.min(ringWall(), 1.6), S.METAL)
    if (c.id === 'MV') S.head = makeSlider(0.0, S.METAL)
    if (c.id === 'ND') S.head = makeNudo(ringWall(), S.METAL, S.WMM)
    S.ring2 = S.GW > 0 ? makeRing('S', Math.min(ringWall(), 1.5), S.GMETAL === 'same' ? (S.METAL || 'YG') : S.GMETAL, S.GW) : null
    if (!THUMBING) { SLOTS[AI] ??= { objs: null, st: null }; SLOTS[AI].objs = { ring: S.ring, ring2: S.ring2, head: S.head }; SLOTS[AI].st = snap(); notifySlots() }
  }

  // ---- 끼운 반지(슬롯): 슬롯마다 3D 객체(objs)와 옵션 상태(st)를 가짐. S 와 S.ring/ring2/head 는 지금 고르는 슬롯(AI)의 것
  const KEYS = ['FINGER', 'GAPMM', 'CI', 'WMM', 'WALL', 'METAL', 'PAVE', 'GW', 'GPAVE', 'GMETAL', 'RMETAL', 'CUT', 'CT', 'GEM', 'PRONG']
  const SLOTS: { objs: { ring: any; ring2: any; head: any } | null; st: any }[] = []
  const MAX_PER_FINGER = 3
  let AI = 0, THUMBING = false, MASKS: any[] = [], PICKF = false   // PICKF: 반지 낄 손가락을 고르는 중
  const snap = () => Object.fromEntries(KEYS.map(k => [k, S[k]]))
  const slotList = () => SLOTS.map((sl, i) => ({ id: CAT[sl.st.CI].id, active: i === AI, finger: sl.st.FINGER as string }))
  const notifySlots = () => els.onSlots?.(slotList())
  function activate(i: number) {   // i 번째 슬롯을 지금 고르는 슬롯으로
    AI = i; const sl = SLOTS[i]; Object.assign(S, sl.st); S.ring = sl.objs!.ring; S.ring2 = sl.objs!.ring2; S.head = sl.objs!.head
  }
  // 손가락 고르기: 손가락마다 반지 자리에 ＋ 점을 띄움 (영상은 멈춤). 한 손가락에 최대 3개
  function emitHints() {
    const cnt = {}; SLOTS.forEach(sl => { cnt[sl.st.FINGER] = (cnt[sl.st.FINGER] || 0) + 1 })
    els.onHints?.(PICKF ? FINGERS.filter(f => (cnt[f] || 0) < MAX_PER_FINGER).map(f => ({ f, name: FINGER_NAME[f], pose: poseOf(f) })).filter(h => h.pose).map(h => ({ f: h.f, name: h.name, x: h.pose[0], y: h.pose[1] })) : [])
  }
  function setPick(on: boolean) { PICKF = on; if (!on) resumeAt = performance.now() + 800; emitHints() }
  function switchSlot(i: number) { if (i === AI || !SLOTS[i]) return; activate(i); notifySlots(); show() }
  function addSlot(finger?: string) {   // 지금 반지와 같은 설정으로 하나 더 (가드링은 없음으로), 끼울 손가락은 finger
    if (SLOTS.length >= 8) return
    const st = snap(); if (SLOTS.filter(sl => sl.st.FINGER === (finger ?? st.FINGER)).length >= MAX_PER_FINGER) return   // 한 손가락에 최대 3개
 S.ring = S.ring2 = S.head = null; AI = SLOTS.length; SLOTS.push({ objs: null, st: null }); Object.assign(S, st, { GW: 0, FINGER: finger ?? st.FINGER, GAPMM: 2.5 }); rebuild(); show()
  }
  function removeSlot(i: number) {
    if (SLOTS.length < 2 || !SLOTS[i]) return
    const o = SLOTS[i].objs!; dispose(o.ring); dispose(o.ring2); if (o.head) S.scene.remove(o.head)
    SLOTS.splice(i, 1); activate(Math.min(AI > i ? AI - 1 : AI, SLOTS.length - 1)); notifySlots(); show()
  }
  // 파베 설정은 rings.json 에서 읽음. layoutStones 가 ys 배열 등을 건드리므로 매번 복사해서 넘김
  function paveCfgOf(st) { const c = CAT[st.CI]; const v = st.PAVE !== 'none' && c.pave?.[st.PAVE]?.byWidth?.[String(st.WMM)]; return v ? structuredClone(v) : null }

  // 반지 놓기: 로컬 y = 손가락 축, 로컬 +z = 손등 쪽
  function setRing(g, q, pos, Rin, bandW, axis, off, cfg, sx = 1) {   // sx: 화면에서 손가락 옆 방향으로만 조임 (반지 모양은 그대로 둥글게)
    g.visible = true; g.quaternion.copy(q); g.scale.set(Rin, bandW / H, Rin); g.position.copy(pos).add(axis.clone().multiplyScalar(off))
    const s = g.userData.stones; s.visible = !!cfg
    if (cfg) { layoutStones(g, cfg, (bandW / H) / Rin); s.scale.setScalar(Rin); s.quaternion.copy(q); s.position.copy(g.position) }
    [g, s].forEach(o => { o.matrixAutoUpdate = sx === 1; o.updateMatrix() })
    if (sx !== 1) { // 화면 평면에서 손가락 축에 수직인 방향 L로만 sx배 (카메라 쪽 깊이는 건드리지 않아 옆으로 돌아도 납작해지지 않음)
      const a = new THREE.Vector2(axis.x, axis.y).normalize(), L = new THREE.Vector3(-a.y, a.x, 0), c = g.position
      const Sm = new THREE.Matrix4().set(1 + (sx - 1) * L.x * L.x, (sx - 1) * L.x * L.y, 0, 0, (sx - 1) * L.y * L.x, 1 + (sx - 1) * L.y * L.y, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
      const W = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(Sm).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
      [g, s].forEach(o => { o.matrix.premultiply(W) })
    }
  }

  // 손 종류별 설정. 예시 손: 이 영상에 맞춰 잡은 보정값 + 저장된 반지 자리(P). 내 영상: 보정 없음, 잰 약지 폭으로 크기·자리 결정
  const DEMO = { tilt: 1.8, lsh: 0.07, sqz: 0.89, frk: 0.85, measured: false }   // tilt 손등 기울기 배수, lsh 옆 이동, sqz 옆 조임, frk 크기 배율
  const MINE = { tilt: 1, lsh: 0, sqz: 1, frk: 1, measured: true }
  let T = DEMO
  let OX = 0, OY = 0, DZK = 0.3, FEATHER = 0.8, OCCK = 0.89
  const V = (L, i) => new THREE.Vector3(L[i][0] + OX, -(L[i][1] + OY), -L[i][2])   // DZK: 손가락이 카메라 쪽으로 기운 정도(깊이)를 얼마나 믿을지
  function placeOcc(L, rad) {
    SEGS.forEach(([i, j, k], n) => {
      const a = V(L, i), b = V(L, j), m = occ[n], d = b.clone().sub(a), len = d.length()
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.scale.set(rad * k, len, rad * k); m.visible = true
    })
    JI.forEach((i, n) => { occJ[n].position.copy(V(L, i)); occJ[n].scale.setScalar(rad * 0.9); occJ[n].visible = true })
  }
  function hideOcc() { occ.forEach(m => m.visible = false); occJ.forEach(m => m.visible = false) }
  function dorsal(i) {
    const s = new THREE.Vector3()
    for (let k = -2; k <= 2; k++) { const L = LMS[Math.max(0, Math.min(N - 1, i + k))]; if (!L) continue; const a = V(L, 5).sub(V(L, 0)), b = V(L, 17).sub(V(L, 0)); s.add(a.cross(b).normalize()) }
    const Lr = LMS[PMAX], ref = V(Lr, 5).sub(V(Lr, 0)).cross(V(Lr, 17).sub(V(Lr, 0))); if (ref.z < 0) s.negate(); return s.normalize()
  }
  function tiltUp(d) { const v = new THREE.Vector3(d.x * T.tilt, d.y * T.tilt, d.z); return v.normalize() }   // 손등 기울기를 TILT배로 키움
  function frameFor(axis, nrm, bl = 0.4) { // 손등 방향(축에 수직) 구하고 회전 만들기
    const Y = nrm.clone().sub(axis.clone().multiplyScalar(nrm.dot(axis)))
    const camv = new THREE.Vector3(0, 0, 1).sub(axis.clone().multiplyScalar(axis.z))
    Y.normalize().multiplyScalar(1 - bl).add(camv.normalize().multiplyScalar(bl)).normalize()
    const qR = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(axis, Y), axis, Y))
    const Z = axis.clone().negate(), qH = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(Y, Z), Y, Z))
    return { qR, qH }
  }
  // 손가락별 반지 자리 [cx,cy,cz,dx,dy,dz,반지 안쪽 반지름(px), 폭으로 잰 자리면 true]. 없으면 null
  //  - 잰 폭이 있으면(내 영상은 항상): 중심 = 관절 두 점을 4:6, 방향 = 관절 방향, 크기 = 그 손가락 고정 폭 × (이 프레임 관절 길이 ÷ 잰 프레임들 길이)
  //  - 예시 손의 약지: 저장된 반지 자리(P)
  //  - 예시 손의 다른 손가락: 폭을 다 재기 전에는 약지 자리 비율로 임시 배치, 다 재고 나면 위의 잰 폭 방식
  const DEMO_K = { thumb: 1.25, index: 0.98, middle: 1.05, ring: 1, pinky: 0.85 }
  const jlen = (f, i) => { const L = SM[i]; if (!L) return 0; const [a, b] = JOINT[f]; return Math.hypot(L[b][0] - L[a][0], L[b][1] - L[a][1]) }
  function poseOf(f) {   // 반지 자리·방향·크기는 모두 5프레임 평균 낸 점(SM)에서 계산. 원래 점(LMS)은 폭 재기·디버그 그리기용
    const L = SM[cur]; if (!L) return null
    const [ia, ib] = JOINT[f], a = L[ia], b = L[ib]
    const fx = fixed?.[f], len = jlen(f, cur)
    const jd = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, sh = fx ? fx.O * len : 0   // 피부 가운데로 옆 이동 (축에 수직)
    const byWidth = fx && fx.n && len > 0 ? [a[0] * 0.6 + b[0] * 0.4 - (b[1] - a[1]) / jd * sh, a[1] * 0.6 + b[1] * 0.4 + (b[0] - a[0]) / jd * sh, a[2] * 0.6 + b[2] * 0.4, b[0] - a[0], b[1] - a[1], b[2] - a[2], fx.W * len / fx.L / 2, true] : null
    if (T.measured) return byWidth
    const Q = P[cur]; if (!Q) return null
    if (f === 'ring') return Q
    if (byWidth) return byWidth
    const ox = Q[0] - (L[13][0] + L[14][0]) / 2, oy = Q[1] - (L[13][1] + L[14][1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], n = Math.hypot(dx, dy, dz) || 1
    return [(a[0] + b[0]) / 2 + ox, (a[1] + b[1]) / 2 + oy, (a[2] + b[2]) / 2, dx / n, dy / n, dz / n, Q[6] * DEMO_K[f]]
  }
  function hideAll() { SLOTS.forEach(({ objs: o }) => { if (!o) return; [o.ring, o.ring2].forEach(g => { if (g) { g.visible = false; g.userData.stones.visible = false } }); if (o.head) o.head.visible = false }) }
  function place() {
    hideAll(); MASKS = []; CLIPS = {}
    const used = [...new Set(SLOTS.map(sl => sl.st.FINGER as string))]
    const poses = Object.fromEntries(used.map(f => [f, poseOf(f)]))
    const refF = poseOf('ring') ? 'ring' : used.find(f => poses[f])   // 가림 원통·잘라내기 평면 기준 손가락 (약지가 있으면 약지)
    if (!refF) { usedW = null; outerPx = null; S.MASK = null; hideOcc(); return }
    if (!poses[refF]) poses[refF] = poseOf(refF)
    const FD = S.FD, qd = tiltUp(dorsal(cur))
    let ref = null
    used.forEach(f => {
      const pf = poses[f]; if (!pf) return
      const [cx, cy, cz, dx, dy, dz, fr] = pf, bw = pf[7] === true, frk = bw ? 1 : T.frk, lsh = bw ? 0 : T.lsh, sqz = bw ? 1 : T.sqz   // 잰 폭 자리는 예시 영상용 보정(크기 배율·옆 이동·옆 조임)을 쓰지 않음
      const axis = new THREE.Vector3(dx, -dy, -dz * DZK).normalize(), pos = new THREE.Vector3(cx, -cy, -cz)
      const frK = fr * frk, pxmm = 2 * frK / FD, Rin = frK, gap = 0.2 * pxmm
      const { qR, qH } = frameFor(axis, qd, 0.1)   // 손이 돈 만큼보다 조금 더 돌려서 알의 옆면(크라운·발)이 보이게
      pos.add(new THREE.Vector3(1, 0, 0).applyQuaternion(qR).multiplyScalar(Rin * lsh))   // lsh: 반지를 손가락 옆 방향으로 살짝 옮김 (이 영상에서 왼쪽으로 치우쳐 보여서)
      const u2 = Math.hypot(dx, dy) || 1
      if (f === refF) ref = { frK, cx, cy }
      // 이 손가락의 뒤쪽 잘라내기 평면: 관절 방향(축)에 수직인 면 중 카메라 쪽 방향, 반지 중심에서 살짝 뒤. 같은 손가락에 여러 개 끼면 여유를 더 줌
      const nn = new THREE.Vector3(0, 0, 1); nn.sub(axis.clone().multiplyScalar(nn.dot(axis)))
      const cnt = SLOTS.filter(sl => sl.st.FINGER === f).length
      CLIPS[f] = nn.length() < 0.15 ? new THREE.Plane(new THREE.Vector3(0, 0, 1), 1000) : new THREE.Plane().setFromNormalAndCoplanarPoint(nn.normalize(), pos.clone().add(nn.clone().multiplyScalar(-Rin * (cnt > 1 ? 0.6 : 0.15))))
      // 같은 손가락에 낀 반지들: 처음 낀 반지는 제자리, 나중에 낀 반지는 폭 + 앞 반지와의 간격(GAPMM)만큼 손톱 쪽으로 차곡차곡 (위 = 손톱 쪽 = 나중에 낀 반지)
      const idx = SLOTS.map((_, i) => i).filter(i => SLOTS[i].st.FINGER === f && SLOTS[i].objs)
      let end = 0
      const offs = idx.map((i, n) => { const q = SLOTS[i].st, w = q.WMM + (q.GW > 0 ? q.GW + 0.2 : 0), o = (n ? end + q.GAPMM : 0) + q.WMM / 2; end = (n ? end + q.GAPMM : 0) + w; return o })
      SLOTS.forEach((sl, si) => {
        const st = sl.st, o = sl.objs; if (!o || st.FINGER !== f) return
        const n = idx.indexOf(si), offpx = (offs[n] - offs[0]) * pxmm   // 처음 낀 반지 기준으로 축을 따라 옮길 거리(px)
        const bandW = st.WMM * pxmm, W2 = st.GW * pxmm
        setRing(o.ring, qR, pos, Rin, bandW, axis, offpx, paveCfgOf(st), sqz)
        if (o.ring2) setRing(o.ring2, qR, pos, Rin, W2, axis, offpx + bandW / 2 + gap + W2 / 2, st.GPAVE ? { ys: [0], arc: 1, d: st.GW * 0.75 } : null, sqz)
        const t = o.ring.userData.t
        if (si === AI) { outerPx = 2 * Rin * (1 + t); usedW = fr * 2; S.pxmmNow = pxmm }
        const MK = { cx: cx + dx / u2 * offpx, cy: cy + dy / u2 * offpx, ux: dx / u2, uy: dy / u2, hw: Rin * sqz * (1 + t * 1.8) + 2 + 0.6 * pxmm, hl: bandW + W2 + Rin * 1.5 }   // 끝을 자르지 않도록 넉넉하게
        const head = o.head
        if (head) {
          const qq = head.userData.slide ? qR.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)) : qH; head.quaternion.copy(qq); head.userData.q0 = qq.clone(); head.userData.axis = axis.clone(); slideHead(head); head.position.copy(pos).add(axis.clone().multiplyScalar(offpx)); head.scale.setScalar(pxmm); head.visible = true
          MK.hw += (head.userData.top + head.userData.W / 2 - FD / 2) * pxmm; MK.hl = Math.max(MK.hl, (head.userData.L / 2 + 1.5) * pxmm * 1.2)
        }
        MASKS.push(MK)
      })
    })
    S.MASK = MASKS[0] || null
    if (!ref) { hideOcc(); return }
    if (T.measured) { OX = 0; OY = 0 } else { const L = SM[cur]; OX = ref.cx - (L[13][0] + L[14][0]) / 2; OY = ref.cy - (L[13][1] + L[14][1]) / 2 }
    placeOcc(SM[cur], ref.frK * OCCK)
  }

  // 그리기: 손가락마다 따로 그림 (손가락마다 잘라내기 평면이 달라서). 가림 원통은 깊이만 먼저 한 번 그리고, 반지는 손가락별로
  //  ① 그 손가락 반지만 보이게 ② renderer.clippingPlanes = 그 손가락 평면 ③ render. autoClear 를 꺼서 앞 손가락 그림이 지워지지 않게 함
  let CLIPS: Record<string, any> = {}
  function renderMain() {
    const objs = SLOTS.map(sl => { const o = sl.objs; return o ? [o.ring, o.ring?.userData.stones, o.ring2, o.ring2?.userData.stones, o.head].filter(Boolean) : [] })
    const was = objs.map(l => l.map(g => g.visible)), occs = [...occ, ...occJ], occWas = occs.map(m => m.visible)
    renderer.autoClear = false; renderer.clippingPlanes = []; renderer.clear()
    objs.forEach(l => l.forEach(g => { g.visible = false })); renderer.render(S.scene, cam)   // 가림 원통(깊이만)
    occs.forEach(m => { m.visible = false })
    Object.keys(CLIPS).forEach(f => {
      objs.forEach((l, i) => l.forEach((g, k) => { g.visible = was[i][k] && SLOTS[i].st.FINGER === f }))
      renderer.clippingPlanes = [CLIPS[f]]; renderer.render(S.scene, cam)
    })
    renderer.clippingPlanes = []; renderer.autoClear = true
    objs.forEach((l, i) => l.forEach((g, k) => { g.visible = was[i][k] })); occs.forEach((m, i) => { m.visible = occWas[i] })
  }

  // 캔버스 크기는 달라졌을 때만 바꿈 (width 를 다시 쓰면 매번 메모리를 새로 잡고 지워서 느림)
  const fit = (c: HTMLCanvasElement) => { if (c.width !== cv.width || c.height !== cv.height) { c.width = cv.width; c.height = cv.height } }
  const maskCv = document.createElement('canvas')
  function composite() {
    fit(outc); const k = cv.width / IW
    ox.clearRect(0, 0, outc.width, outc.height); if (!MASKS.length) return
    ox.drawImage(cv, 0, 0)
    fit(maskCv); const mx = maskCv.getContext('2d'); mx.clearRect(0, 0, maskCv.width, maskCv.height); mx.fillStyle = '#000'   // 반지마다 자를 영역을 모두 합쳐서 한 번에 자름
    MASKS.forEach(({ cx, cy, ux, uy, hw, hl }) => {
      const px = -uy, py = ux; mx.beginPath();
      [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].forEach(([a, b], i) => { const X = (cx + ux * a + px * b) * k, Y = (cy + uy * a + py * b) * k; i ? mx.lineTo(X, Y) : mx.moveTo(X, Y) })
      mx.closePath(); mx.fill()
    })
    ox.globalCompositeOperation = 'destination-in'; ox.filter = `blur(${FEATHER * k}px)`; ox.drawImage(maskCv, 0, 0); ox.filter = 'none'
    ox.globalCompositeOperation = 'source-over'
  }
  const tmp = document.createElement('canvas')
  function shadow() {
    fit(sh); const k = cv.width / IW
    sx2.clearRect(0, 0, sh.width, sh.height)
    // 그림자 두 겹: 넓고 옅은 그림자(공중에 뜬 느낌 지움) + 반지가 피부에 닿는 곳의 짙고 좁은 접촉 그림자
    fit(tmp); const tx = tmp.getContext('2d');
    [[7, 2, 4, 'rgba(70,40,32,0.32)'], [1.6, 0.6, 1.4, 'rgba(45,25,20,0.75)']].forEach(([bl, dx, dy, col]) => {
      tx.clearRect(0, 0, tmp.width, tmp.height); tx.filter = `blur(${bl * k}px)`; tx.drawImage(outc, dx * k, dy * k); tx.filter = 'none'
      tx.globalCompositeOperation = 'source-in'; tx.fillStyle = col; tx.fillRect(0, 0, tmp.width, tmp.height); tx.globalCompositeOperation = 'source-over'
      sx2.drawImage(tmp, 0, 0)
    })
  }

  // 한 프레임 그리는 시간(ms): show 는 반지 놓기부터 그림자까지, 반짝임 갱신은 그리기부터 그림자까지. 최근 30번을 디버그에 보여줌
  const drawMs: number[] = []
  const lap = (t0: number) => { drawMs.push(performance.now() - t0); if (drawMs.length > 30) drawMs.shift() }
  function show(i = cur) {
    cur = Math.max(PMIN, Math.min(PMAX, Math.round(i))); img.src = frames[cur]
    if (P[cur]) zc = [P[cur][0], P[cur][1]]
    const t0 = performance.now(); place(); renderMain(); composite(); shadow(); lap(t0); applyZoom(); drawDebug(); wantMask(); report(); if (PICKF) emitHints()
  }

  // 디버그: MediaPipe 21점과 뼈대 선. 약지 13·14번 점과 13→14 선은 빨간색으로 크게
  // + 피부 마스크(반투명 빨강) + 약지 폭 재기(소지선 17→18 ~ 중지선 9→10 사이)
  let DEBUG = false
  let fixed: Record<string, { W: number; L: number; n: number; O: number }> | null = null   // 손가락별 고정 폭(px), 잰 프레임들의 관절 길이(px), 잰 프레임 수
  let usedW: number | null = null, outerPx: number | null = null
  // 재생 구간을 다 재고 나면, 손가락마다 양쪽 경계가 다 잡힌 프레임들의 폭 가운데값을 하나로 고정
  function refix() {
    if (fixed) return false
    for (let i = PMIN; i <= PMAX; i++) if (!meas.get(frames[i])) return false
    fixed = Object.fromEntries(FINGERS.map(f => {
      const ws: number[] = [], ls: number[] = [], os: number[] = []
      const [ja, jb] = JOINT[f]
      for (let i = PMIN; i <= PMAX; i++) {
        const q = meas.get(frames[i])[f]
        if (q.w == null) continue
        ws.push(q.w); ls.push(jlen(f, i))
        // 잰 피부 경계의 가운데가 관절 축에서 옆으로 얼마나 벗어났는지 (관절 길이 대비, 축에 수직 방향 기준)
        const L = LMS[i]; if (!L) continue
        const dx = L[jb][0] - L[ja][0], dy = L[jb][1] - L[ja][1], d = Math.hypot(dx, dy) || 1
        os.push((((q.A[0] + q.B[0]) / 2 - q.c[0]) * -dy + ((q.A[1] + q.B[1]) / 2 - q.c[1]) * dx) / d / d)
      }
      return [f, ws.length ? { W: median(ws), L: median(ls), n: ws.length, O: os.length ? median(os) : 0 } : { W: 0, L: 1, n: 0, O: 0 }]
    }))
    return true
  }
  const masks = new Map<string, SkinMask>(), meas = new Map<string, any>(), inflight = new Map<string, Promise<void>>()
  let warmId = 0   // 손 영상이 바뀌면 올라가서, 이전 영상의 계산 결과를 버림
  function ensureMask(i: number) {   // 프레임 i 의 마스크와 폭을 (아직 없으면) 계산
    const url = frames[i]; if (!url || masks.has(url)) return Promise.resolve()
    let p = inflight.get(url)
    if (!p) {
      const id = warmId
      p = skinMask(url).then(m => {
        if (id !== warmId) return
        masks.set(url, m); const L = LMS[i]; if (L) meas.set(url, measure(L, m))
        if (refix()) show(cur); else { report(); if (DEBUG && frames[cur] === url) drawDebug() }
      }).catch(() => {}).finally(() => inflight.delete(url))
      inflight.set(url, p)
    }
    return p
  }
  function wantMask() { if (DEBUG) ensureMask(cur) }
  async function warm() { const id = warmId; for (let i = PMIN; i <= PMAX && id === warmId; i++) await ensureMask(i) }   // 재생 구간 전체를 미리 계산
  function report() { if (els.onInfo) (T.measured ? reportMine : reportDemo)(els.onInfo) }
  // 내 영상: 폭 재는 중 / 실패 / (디버그) 고정 폭과 반지 크기
  // 손가락별: 재생 구간에서 양쪽 경계가 잡힌 프레임들의 폭 가운데값(잰 프레임 수)
  let fingerMemo: { n: number; txt: string } | null = null   // 측정 개수가 같으면 다시 계산하지 않음 (끝나면 그대로)
  function fingerLine() {
    if (fingerMemo && fingerMemo.n === meas.size) return fingerMemo.txt
    const txt = FINGERS.map(f => {
      const ws: number[] = []
      for (let i = PMIN; i <= PMAX; i++) { const q = meas.get(frames[i])?.[f]; if (q?.w != null) ws.push(q.w) }
      return `${FINGER_NAME[f]} ${ws.length ? median(ws).toFixed(1) : '-'}(${ws.length})`
    }).join(' · ')
    fingerMemo = { n: meas.size, txt }
    return txt
  }
  const msLine = () => drawMs.length ? `\n그리기 ${(drawMs.reduce((a, b) => a + b, 0) / drawMs.length).toFixed(1)}ms (최근 ${drawMs.length}번 평균, 최대 ${Math.max(...drawMs).toFixed(1)}ms)` : ''
  function reportMine(say: (s: string) => void) {
    const total = PMAX - PMIN + 1; let done = 0
    for (let i = PMIN; i <= PMAX; i++) if (meas.get(frames[i])) done++
    if (!fixed) { say(`약지 폭 재는 중 ${done}/${total}`); return }
    const fr = fixed.ring
    if (!fr.n) { say('약지 폭을 못 쟀어요 (양쪽 경계가 잡힌 프레임이 없어요)'); return }
    if (!DEBUG) { say(''); return }
    say(`잰 프레임 ${fr.n}/${total} · 고정 폭 ${fr.W.toFixed(1)}px · 이 프레임에 쓴 폭 ${usedW != null ? usedW.toFixed(1) : '-'}px · 반지 바깥 지름 ${outerPx != null ? outerPx.toFixed(1) : '-'}px
${fingerLine()}${msLine()}`)
  }
  // 예시 손: (디버그) 잰 폭 가운데값만 보여줌. 반지 크기에는 쓰지 않음
  function reportDemo(say: (s: string) => void) {
    if (!DEBUG) { say(''); return }
    const ok: number[] = [], total = PMAX - PMIN + 1; let done = 0
    for (let i = PMIN; i <= PMAX; i++) { const r = meas.get(frames[i]); if (!r) continue; done++; if (r.ring.w != null) ok.push(r.ring.w) }
    const cu = meas.get(frames[cur])?.ring
    const head = ok.length ? `폭 ${median(ok).toFixed(1)}px · ${ok.length}프레임 사용` : '폭 아직 없음'
    const prog = done < total ? ` (계산 ${done}/${total})` : done !== ok.length ? ` (${done - ok.length}프레임 제외)` : ''
    const now = cu ? (cu.w != null ? ` · 이 프레임 ${cu.w.toFixed(1)}px (소지 ${cu.kindP}·중지 ${cu.kindM})` : ' · 이 프레임은 제외') : ''
    say(head + prog + now + '\n' + fingerLine() + msLine())
  }
  function drawDebug() {
    const cv2 = els.debug; if (!cv2) return
    const L = DEBUG && LMS[cur]
    if (!L) { cv2.getContext('2d').clearRect(0, 0, cv2.width, cv2.height); return }
    drawHandDebug(cv2, L, masks.get(frames[cur]), meas.get(frames[cur]))
  }

  // ---- 무빙원 알: 손가락 축을 따라 돌며 좌우로 미끄러짐
  let slideT = 0
  function slideHead(head) { const u = head && head.userData; if (!u || !u.slide || !u.q0) return; head.quaternion.copy(u.q0).premultiply(new THREE.Quaternion().setFromAxisAngle(u.axis, u.amp * Math.sin(slideT * 0.9))) }

  function pickRing(i) {
    if (i === S.CI && S.ring) return
    S.CI = i; const c = CAT[i]; S.WMM = c.defaultWidth; S.WALL = c.wall; S.METAL = c.metal; S.PAVE = 'none'
    if (c.gem) S.GEM = c.gem; else if (c.id === 'SOL' && NUDO_GEMS.includes(S.GEM)) S.GEM = 'dia'
    rebuild(); show()
  }

  // ---- 썸네일: 같은 렌더러로 작은 칸에 반지를 하나씩 그려 이미지로
  function makeThumbs() {
    const thumbs = {}
    const tScene = new THREE.Scene(); tScene.environment = STORE_ENV; tScene.add(new THREE.AmbientLight(0xffffff, 0.25 * LI))
    const tk = new THREE.DirectionalLight(0xffffff, 1.3 * LI); tk.position.set(-0.4, 1, 0.8); tScene.add(tk)
    const tCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100); tCam.position.z = 50
    const SZ = 136, pr = renderer.getPixelRatio(), tc = document.createElement('canvas'); tc.width = tc.height = SZ; const tx = tc.getContext('2d')
    THUMBING = true; const keep = { CI: S.CI, WMM: S.WMM, WALL: S.WALL, METAL: S.METAL, PAVE: S.PAVE, GW: S.GW, GEM: S.GEM }; S.scene = tScene; clip.set(new THREE.Vector3(0, 0, 1), 1000)
    renderer.setScissorTest(true); renderer.setViewport(0, 0, SZ / pr, SZ / pr); renderer.setScissor(0, 0, SZ / pr, SZ / pr); renderer.toneMappingExposure = 1.3
    const axis = new THREE.Vector3(0, 0.62, 0.78).normalize()
    CAT.forEach((c, i) => {
      S.CI = i; S.WMM = c.defaultWidth; S.WALL = c.wall; S.METAL = c.metal; S.PAVE = c.id === 'IC' ? 'semi' : 'none'; S.GW = 0; if (c.gem) S.GEM = c.gem; rebuild()
      const Rin = 0.58, pxmm = Rin / (S.FD / 2), pos = new THREE.Vector3(0, c.id === 'SOL' || c.id === 'ND' ? -0.25 : -0.05, 0), { qR, qH } = frameFor(axis, new THREE.Vector3(0, 0.78, -0.62), 0)
      setRing(S.ring, qR, pos, Rin, S.WMM * pxmm, axis, 0, paveCfgOf(S))
      const head = S.head
      if (head) { head.quaternion.copy(qH); head.position.copy(pos); head.scale.setScalar(pxmm); head.visible = true }
      renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(tScene, tCam)
      tx.clearRect(0, 0, SZ, SZ); tx.drawImage(cv, 0, cv.height - SZ, SZ, SZ, 0, 0, SZ, SZ); thumbs[c.id] = tc.toDataURL()
    })
    dispose(S.ring); dispose(S.ring2); S.ring = S.ring2 = null; if (S.head) { tScene.remove(S.head); S.head = null }
    S.scene = mainScene; renderer.setScissorTest(false); renderer.setViewport(0, 0, IW, IH)
    Object.assign(S, keep); THUMBING = false
    return thumbs
  }

  // 가만히 있어도 반짝이게: 파베 알이 하나씩 반짝이고, 큰 알과 조명이 아주 살짝 움직임 (초당 15번)
  // 손 영상 자동 재생: 앞뒤로 계속 왕복 (초당 10장). 손으로 끌면 멈췄다가 1.5초 뒤 다시 돎
  let lastTw = 0, lastRep = 0, raf = 0
  function twinkle(now) {
    raf = requestAnimationFrame(twinkle)
    if (AUTO && !PICKF && !document.hidden && dragX === null && now > resumeAt && now - lastPlay > 100) {
      lastPlay = now; let n = cur + playDir
      if (n < PMIN || n > PMAX) { playDir = -playDir; n = Math.max(PMIN, Math.min(PMAX, cur + playDir)) }
      show(n)
    }
    if (document.hidden || now - lastTw < 66 || !MASKS.length) return; lastTw = now; const t = now / 1000, os = SLOTS.map(sl => sl.objs).filter(Boolean);
    os.flatMap(o => [o.ring, o.ring2]).forEach(g => {
      if (!g) return; const s = g.userData.stones; if (!s.visible || !s.count) return
      for (let c = 0; c < s.count; c++) {
        const ph = (Math.abs(Math.sin(c * 12.9898) * 43758.5453) % 1) * TAU, base = 0.45 + 0.4 * ((Math.abs(Math.sin(c * 7.13) * 9137.1) % 1))
        const k = base + 0.9 * Math.pow(Math.max(0, Math.sin(t * 1.3 + ph)), 12), B = s.userData.base; s.setColorAt(c, B ? TW.setRGB(B[c * 3] * k, B[c * 3 + 1] * k, B[c * 3 + 2] * k) : TW.setScalar(k))
      }
      s.instanceColor.needsUpdate = true
    })
    slideT = t
    os.forEach(({ head }) => {
      if (head && head.userData.slide) slideHead(head)
      if (head && head.userData.gem && !head.userData.slide) { const gm = head.userData.gem; gm.rotation.y = 0.06 * Math.sin(t * 0.7); gm.rotation.x = 0.04 * Math.sin(t * 1.1) }
    })
    key.position.set(-0.4 + 0.35 * Math.sin(t * 0.5), 1, 0.8 + 0.2 * Math.cos(t * 0.4))
    const t0 = performance.now(); renderMain(); composite(); shadow(); lap(t0)
    if (DEBUG && now - lastRep > 500) { lastRep = now; report() }
  }

  setHand(hand); const thumbs = makeThumbs(); rebuild(); show()
  raf = requestAnimationFrame(twinkle)
  return {
    thumbs,
    // 상세 설정: 현재 고른 옵션 읽기 / 바꾸기 (바꾸면 반지를 다시 만들어 그림)
    state() { const { CI, WMM, WALL, METAL, PAVE, GW, GPAVE, GMETAL, RMETAL, CUT, CT, GEM, PRONG, GAPMM } = S, stacked = SLOTS.findIndex(sl => sl.st.FINGER === S.FINGER) < AI; return { CI, WMM, WALL, METAL, PAVE, GW, GPAVE, GMETAL, RMETAL, CUT, CT, GEM, PRONG, GAPMM, stacked } },   // stacked: 같은 손가락에서 먼저 낀 반지가 있음(간격 고르기 가능)
    set(patch: Record<string, any>) { Object.assign(S, patch); rebuild(); show() },
    setHand(h: HandData) { setHand(h); show(PMAX) },
    dragStart(x: number, y: number) { dragX = x; dragY = y; drag0 = cur },
    dragMove(x: number, y: number, w: number) {
      if (dragX === null) return
      const dx = x - dragX, dy = dragY - y
      show(drag0 + (Math.abs(dy) > Math.abs(dx) ? dy : dx) / (w || 300) * N * 1.2)
    },
    dragEnd() { dragX = null; resumeAt = performance.now() + 1500 },
    pick(id: string) { const i = CAT.findIndex(c => c.id === id); if (i >= 0) pickRing(i) },
    // 위쪽 버튼: 재생/멈춤, 가까이, 내 호수(안쪽 둘레 40+호수 mm 로 손가락 굵기를 다시 잡음)
    setDebug(on: boolean) { DEBUG = on; if (on) { warm(); wantMask() } report(); drawDebug() },
    setPlaying(on: boolean) { AUTO = on; resumeAt = 0 },
    setZoom(on: boolean) { zoom = on; renderer.setPixelRatio(on ? 3 : Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(IW, IH, false); show() },
    setHo(ho: number) { S.HO = ho; S.FD = (40 + ho) / Math.PI; const keepAI = AI; SLOTS.forEach((_, i) => { activate(i); rebuild() }); activate(keepAI); show() },   // 끼운 반지 모두 새 호수로 다시 만듦
    // 끼운 반지(슬롯)
    slots: slotList,
    switchSlot, addSlot, removeSlot, setPick,
    stop() { removeEventListener('resize', applyZoom); cancelAnimationFrame(raf); SLOTS.forEach(({ objs: o }) => { if (!o) return; dispose(o.ring); dispose(o.ring2); if (o.head) S.scene.remove(o.head) }); SLOTS.length = 0; S.ring = S.ring2 = S.head = null },
  }
}
