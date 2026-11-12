// @ts-nocheck  (조명·배치·합성·반짝임)
import * as THREE from 'three'
import { S, M, H, TAU, IW, IH, LI, cv, renderer, mainScene, cam, pmg, clip } from './shared.ts'
import { GEMS, NUDO_GEMS, makeHead } from './sol.ts'
import { makeRing, TW } from './makeRing.ts'
import { layoutStones } from './layoutStones.ts'
import { skinMask } from '../hand/skin.ts'
import type { SkinMask } from '../hand/skin.ts'
import { makeSlider, makeNudo } from './heads.ts'

// public/rings.json 의 반지 한 개. pave.*.byWidth[폭] = layoutStones 에 넘기는 설정
export type PaveOpt = { label: string; byWidth: Record<string, any> }
export type RingInfo = {
  id: string; name: string; sub: string; widths: number[]; widthLabels?: Record<string, string>; defaultWidth: number
  wall: number; metal: string | null; diy: boolean; rimColor: boolean; gemPick: boolean; gem: string | null
  pave: Partial<Record<'semi' | 'alt' | 'full' | 'both', PaveOpt>>
}
// frames: 프레임 이미지 주소, P/LMS: 프레임별 손 좌표, pmin~pmax: 왕복 재생할 구간
export type HandData = { N: number; P: (number[] | null)[]; LMS: number[][][]; frames: string[]; pmin: number; pmax: number; custom?: boolean }
export type StageEls = { img: HTMLImageElement; shadow: HTMLCanvasElement; out: HTMLCanvasElement; debug?: HTMLCanvasElement; onInfo?: (s: string) => void }

// ---- 조명
function makeEnv(bg, lights) {
  const es = new THREE.Scene()
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: bg })))
  lights.forEach(([c, x, y, z, s]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); es.add(p) })
  return pmg.fromScene(es, 0.02).texture
}
const STORE_ENV = makeEnv(0x2e2e31, [[0xcfcfcf, 0, 42, 0, 16], [0xffffff, 20, 38, 10, 7], [0xffffff, -20, 38, 10, 7], [0xffffff, 0, 15, 45, 18], [0xffffff, 38, 10, 18, 8], [0xffffff, -38, 10, 18, 8], [0xffffff, -20, 25, -35, 16], [0xeef2ff, 25, -10, 35, 10], [0x8c8a88, 0, -45, 0, 60]])   // 썸네일용
mainScene.environment = makeEnv(0x101211, [[0xffffff, 0, 45, 0, 18], [0xf2f7f5, 30, 40, 0, 10], [0xf2f7f5, -30, 40, 0, 10], [0xe8efed, 0, 12, 45, 10], [0xffffff, -40, 5, -20, 8], [0x2e3432, 0, -45, 0, 60]])   // 손 위 반지용(사무실 조명)
renderer.toneMappingExposure = 1.3
mainScene.add(new THREE.AmbientLight(0xffffff, 0.15 * LI))
const key = new THREE.DirectionalLight(0xf2f6f5, 1.1 * LI); key.position.set(-0.4, 1, 0.8); mainScene.add(key)
const rim = new THREE.DirectionalLight(0xffffff, 0.7 * LI); rim.position.set(0.6, -0.3, -0.2); mainScene.add(rim)   // 뒤쪽 테두리 빛: 반지 가장자리가 밝게 떠서 두께가 보임

// 안 보이는 3D 손 견본(깊이만): 손가락 뒤로 가는 반지 부분을 가림
const occMat = new THREE.MeshBasicMaterial({ colorWrite: false })
const SEGS = [[13, 14, 0.92], [14, 15, 0.88], [15, 16, 0.8], [9, 10, 1.0], [10, 11, 0.95], [11, 12, 0.85], [17, 18, 0.85], [18, 19, 0.8], [19, 20, 0.72], [5, 6, 1.0], [6, 7, 0.95], [7, 8, 0.85], [0, 9, 1.6], [0, 13, 1.6], [0, 17, 1.5], [0, 5, 1.6]]
const occ = SEGS.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false), occMat); m.renderOrder = -1; mainScene.add(m); return m })
const JI = [13, 14, 15, 9, 10, 11, 17, 18, 19, 5, 6, 7]
const occJ = JI.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), occMat); m.renderOrder = -1; mainScene.add(m); return m })

export function createStage(els: StageEls, CAT: RingInfo[], hand: HandData) {
  const { img, shadow: sh, out: outc } = els
  const sx2 = sh.getContext('2d'), ox = outc.getContext('2d')
  let N = 0, P = [], LMS = [], frames = [], PMIN = 0, PMAX = 0, cur = 0
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
    N = h.N; P = h.P; LMS = h.LMS; frames = h.frames; PMIN = h.pmin; PMAX = h.pmax
    // 내가 올린 영상은 예시 손에 맞춰 잡은 보정(손등 기울기, 옆 이동, 옆 조임)을 끔
    // + 반지 크기·위치도 예전 배율(FRK)·P 값 대신 잰 약지 폭으로 정함 (place 참고)
    CUSTOM = !!h.custom; fixed = null
    if (h.custom) { TILT = 1; LSH = 0; SQZ = 1; FRK = 1 } else { TILT = 1.8; LSH = 0.07; SQZ = 0.89; FRK = 0.85 }
    frames.forEach(u => { new Image().src = u })   // 미리 받아두기
    cur = PMAX; playDir = -1; resumeAt = 0; dragX = null
    masks.clear(); meas.clear(); inflight.clear(); warmId++; if (DEBUG || CUSTOM) warm(); report()
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
  }
  // 파베 설정은 rings.json 에서 읽음. layoutStones 가 ys 배열 등을 건드리므로 매번 복사해서 넘김
  function paveCfg() { const c = CAT[S.CI]; const v = S.PAVE !== 'none' && c.pave?.[S.PAVE]?.byWidth?.[String(S.WMM)]; return v ? structuredClone(v) : null }

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

  let OX = 0, OY = 0, DZK = 0.3, FRK = 0.85, SQZ = 0.89, LSH = 0.07, FEATHER = 0.8, OCCK = 0.89
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
  let TILT = 1.8
  function tiltUp(d) { const v = new THREE.Vector3(d.x * TILT, d.y * TILT, d.z); return v.normalize() }   // 손등 기울기를 TILT배로 키움
  function frameFor(axis, nrm, bl = 0.4) { // 손등 방향(축에 수직) 구하고 회전 만들기
    const Y = nrm.clone().sub(axis.clone().multiplyScalar(nrm.dot(axis)))
    const camv = new THREE.Vector3(0, 0, 1).sub(axis.clone().multiplyScalar(axis.z))
    Y.normalize().multiplyScalar(1 - bl).add(camv.normalize().multiplyScalar(bl)).normalize()
    const qR = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(axis, Y), axis, Y))
    const Z = axis.clone().negate(), qH = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(Y, Z), Y, Z))
    return { qR, qH }
  }
  function place(p) {
    const { ring, ring2 } = S
    if (CUSTOM) {   // 내 영상: 중심 = 13·14를 4:6, 방향 = 13→14, 크기 = 고정 폭 × (이 프레임 13→14 길이 ÷ 잰 프레임들 길이)
      const L = LMS[cur], w = widthNow()
      p = L && w != null ? [L[13][0] * 0.6 + L[14][0] * 0.4, L[13][1] * 0.6 + L[14][1] * 0.4, L[13][2] * 0.6 + L[14][2] * 0.4, L[14][0] - L[13][0], L[14][1] - L[13][1], L[14][2] - L[13][2], w / 2] : null
      usedW = w
    }
    if (!p) { usedW = null; outerPx = null; [ring, ring2].forEach(g => { if (g) { g.visible = false; g.userData.stones.visible = false } }); if (S.head) S.head.visible = false; S.MASK = null; hideOcc(); return }
    const [cx, cy, cz, dx, dy, dz, fr] = p
    const FD = S.FD, GW = S.GW, WMM = S.WMM, head = S.head
    const axis = new THREE.Vector3(dx, -dy, -dz * DZK).normalize(), pos = new THREE.Vector3(cx, -cy, -cz)
    const frK = fr * FRK, pxmm = 2 * frK / FD; S.pxmmNow = pxmm; const Rin = frK, bandW = WMM * pxmm, W2 = GW * pxmm, gap = 0.2 * pxmm
    const { qR, qH } = frameFor(axis, tiltUp(dorsal(cur)), 0.1)   // 손이 돈 만큼보다 조금 더 돌려서 알의 옆면(크라운·발)이 보이게
    pos.add(new THREE.Vector3(1, 0, 0).applyQuaternion(qR).multiplyScalar(Rin * LSH))   // LSH: 반지를 손가락 옆 방향으로 살짝 옮김 (이 영상에서 왼쪽으로 치우쳐 보여서)
    setRing(ring, qR, pos, Rin, bandW, axis, 0, paveCfg(), SQZ)
    if (ring2) setRing(ring2, qR, pos, Rin, W2, axis, bandW / 2 + gap + W2 / 2, S.GPAVE ? { ys: [0], arc: 1, d: GW * 0.75 } : null, SQZ)
    if (CUSTOM) { OX = 0; OY = 0 } else { const L = LMS[cur]; OX = cx - (L[13][0] + L[14][0]) / 2; OY = cy - (L[13][1] + L[14][1]) / 2 }
    placeOcc(LMS[cur], frK * OCCK)
    const t = ring.userData.t; outerPx = 2 * Rin * (1 + t); const u2 = Math.hypot(dx, dy) || 1
    S.MASK = { cx, cy, ux: dx / u2, uy: dy / u2, hw: Rin * SQZ * (1 + t * 1.8) + 2 + 0.6 * pxmm, hl: bandW + W2 + Rin * 1.5 }   // 끝을 자르지 않도록 넉넉하게
    const MASK = S.MASK
    if (head) {
      const qq = head.userData.slide ? qR.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)) : qH; head.quaternion.copy(qq); head.userData.q0 = qq.clone(); head.userData.axis = axis.clone(); slideHead(); head.position.copy(pos); head.scale.setScalar(pxmm); head.visible = true
      MASK.hw += (head.userData.top + head.userData.W / 2 - FD / 2) * pxmm; MASK.hl = Math.max(MASK.hl, (head.userData.L / 2 + 1.5) * pxmm * 1.2)
    }
    const n = new THREE.Vector3(0, 0, 1); n.sub(axis.clone().multiplyScalar(n.dot(axis)))
    if (n.length() < 0.15) { clip.set(new THREE.Vector3(0, 0, 1), 1000); return }
    n.normalize(); clip.setFromNormalAndCoplanarPoint(n, pos.clone().add(n.clone().multiplyScalar(-Rin * 0.15)))
  }

  function composite() {
    outc.width = cv.width; outc.height = cv.height; const k = cv.width / IW
    ox.clearRect(0, 0, outc.width, outc.height); if (!S.MASK) return
    ox.drawImage(cv, 0, 0)
    const { cx, cy, ux, uy, hw, hl } = S.MASK, px = -uy, py = ux
    ox.globalCompositeOperation = 'destination-in'; ox.filter = `blur(${FEATHER * k}px)`; ox.fillStyle = '#000'; ox.beginPath();
    [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].forEach(([a, b], i) => { const X = (cx + ux * a + px * b) * k, Y = (cy + uy * a + py * b) * k; i ? ox.lineTo(X, Y) : ox.moveTo(X, Y) })
    ox.closePath(); ox.fill(); ox.filter = 'none'
    ox.globalCompositeOperation = 'source-over'
  }
  const tmp = document.createElement('canvas')
  function shadow() {
    sh.width = cv.width; sh.height = cv.height; const k = cv.width / IW
    sx2.clearRect(0, 0, sh.width, sh.height)
    // 그림자 두 겹: 넓고 옅은 그림자(공중에 뜬 느낌 지움) + 반지가 피부에 닿는 곳의 짙고 좁은 접촉 그림자
    tmp.width = sh.width; tmp.height = sh.height; const tx = tmp.getContext('2d');
    [[7, 2, 4, 'rgba(70,40,32,0.32)'], [1.6, 0.6, 1.4, 'rgba(45,25,20,0.75)']].forEach(([bl, dx, dy, col]) => {
      tx.clearRect(0, 0, tmp.width, tmp.height); tx.filter = `blur(${bl * k}px)`; tx.drawImage(outc, dx * k, dy * k); tx.filter = 'none'
      tx.globalCompositeOperation = 'source-in'; tx.fillStyle = col; tx.fillRect(0, 0, tmp.width, tmp.height); tx.globalCompositeOperation = 'source-over'
      sx2.drawImage(tmp, 0, 0)
    })
  }

  function show(i = cur) {
    cur = Math.max(PMIN, Math.min(PMAX, Math.round(i))); img.src = frames[cur]
    if (P[cur]) zc = [P[cur][0], P[cur][1]]
    place(P[cur]); renderer.render(S.scene, cam); composite(); shadow(); applyZoom(); drawDebug(); wantMask(); report()
  }

  // 디버그: MediaPipe 21점과 뼈대 선. 약지 13·14번 점과 13→14 선은 빨간색으로 크게
  // + 피부 마스크(반투명 빨강) + 약지 폭 재기(소지선 17→18 ~ 중지선 9→10 사이)
  let DEBUG = false, CUSTOM = false
  let fixed: { W: number; L: number; n: number } | null = null   // 고정 폭(px), 잰 프레임들의 13→14 길이(px), 잰 프레임 수
  let usedW: number | null = null, outerPx: number | null = null
  const len1314 = (i: number) => { const L = LMS[i]; return L ? Math.hypot(L[14][0] - L[13][0], L[14][1] - L[13][1]) : 0 }
  function widthNow() { return fixed && fixed.n > 0 && len1314(cur) > 0 ? fixed.W * len1314(cur) / fixed.L : null }
  // 재생 구간을 다 재고 나면, 양쪽 경계가 다 잡힌 프레임들의 폭 가운데값을 하나로 고정
  function refix() {
    if (!CUSTOM || fixed) return false
    const ws: number[] = [], ls: number[] = []
    for (let i = PMIN; i <= PMAX; i++) {
      const r = meas.get(frames[i]); if (!r) return false
      if (r.w != null) { ws.push(r.w); ls.push(len1314(i)) }
    }
    fixed = ws.length ? { W: median(ws), L: median(ls), n: ws.length } : { W: 0, L: 1, n: 0 }
    return true
  }
  const masks = new Map<string, SkinMask>(), meas = new Map<string, any>(), inflight = new Map<string, Promise<void>>()
  let warmId = 0   // 손 영상이 바뀌면 올라가서, 이전 영상의 계산 결과를 버림
  const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
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
  async function warm() { const id = warmId; for (let i = PMIN; i <= PMAX && (DEBUG || CUSTOM) && id === warmId; i++) await ensureMask(i) }   // 재생 구간 전체를 미리 계산
  // 양쪽 경계가 다 잡힌 프레임의 폭만 모아 가운데값(median)을 화면에 알려줌
  function report() {
    if (!els.onInfo) return
    if (CUSTOM) {
      const total = PMAX - PMIN + 1; let done = 0
      for (let i = PMIN; i <= PMAX; i++) if (meas.get(frames[i])) done++
      if (!fixed) { els.onInfo(`약지 폭 재는 중 ${done}/${total}`); return }
      if (!fixed.n) { els.onInfo('약지 폭을 못 쟀어요 (양쪽 경계가 잡힌 프레임이 없어요)'); return }
      if (!DEBUG) { els.onInfo(''); return }
      els.onInfo(`잰 프레임 ${fixed.n}/${total} · 고정 폭 ${fixed.W.toFixed(1)}px · 이 프레임에 쓴 폭 ${usedW != null ? usedW.toFixed(1) : '-'}px · 반지 바깥 지름 ${outerPx != null ? outerPx.toFixed(1) : '-'}px`)
      return
    }
    if (!DEBUG) { els.onInfo(''); return }
    const ok: number[] = [], total = PMAX - PMIN + 1; let done = 0
    for (let i = PMIN; i <= PMAX; i++) { const r = meas.get(frames[i]); if (!r) continue; done++; if (r.w != null) ok.push(r.w) }
    const cu = meas.get(frames[cur])
    const head = ok.length ? `폭 ${median(ok).toFixed(1)}px · ${ok.length}프레임 사용` : '폭 아직 없음'
    const prog = done < total ? ` (계산 ${done}/${total})` : done !== ok.length ? ` (${done - ok.length}프레임 제외)` : ''
    const now = cu ? (cu.w != null ? ` · 이 프레임 ${cu.w.toFixed(1)}px (소지 ${cu.kindP}·중지 ${cu.kindM})` : ' · 이 프레임은 제외') : ''
    els.onInfo(head + prog + now)
  }
  // 13→14 가운데에서 손가락에 수직으로 소지선(17→18)·중지선(9→10)까지 걸어가며 양쪽 경계를 찾음.
  // 경계 = 구간 안에서 마스크가 끝나는 곳, 마스크가 끝까지 이어지면(손가락이 붙음) 밝기가 가장 어두운 곳(손가락 사이 틈)
  function measure(L, m: SkinMask) {
    const a = L[13], b = L[14], c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, u = [dx / len, dy / len]
    let n = [-u[1], u[0]]
    if ((L[9][0] - c[0]) * n[0] + (L[9][1] - c[1]) * n[1] < 0) n = [-n[0], -n[1]]   // +n = 중지 쪽, -n = 소지 쪽
    const hit = (P, Q) => { const d = [Q[0] - P[0], Q[1] - P[1]], den = n[0] * d[1] - n[1] * d[0]; return Math.abs(den) < 1e-6 ? null : ((P[0] - c[0]) * d[1] - (P[1] - c[1]) * d[0]) / den }
    const sM = hit(L[9], L[10]), sP = hit(L[17], L[18])
    if (sM == null || sP == null || sM <= 2 || sP >= -2) return { c, n, w: null, limM: 60, limP: 60 }
    const limM = sM, limP = -sP, fail = { c, n, w: null, limM, limP }
    const skin = (x, y) => { const ix = Math.floor(x * m.w / IW), iy = Math.floor(y * m.h / IH); return ix >= 0 && iy >= 0 && ix < m.w && iy < m.h && m.data[iy * m.w + ix] === 1 }
    const lumaAt = (x, y) => { let t = 0; for (const o of [-2, 0, 2]) { const ix = Math.round((x + u[0] * o) * m.lw / IW), iy = Math.round((y + u[1] * o) * m.lh / IH); t += ix >= 0 && iy >= 0 && ix < m.lw && iy < m.lh ? m.luma[iy * m.lw + ix] : 255 } return t / 3 }
    if (!skin(c[0], c[1])) return fail
    const side = (sg, lim) => {
      let s = 0; while (s < lim && skin(c[0] + n[0] * sg * (s + 0.25), c[1] + n[1] * sg * (s + 0.25))) s += 0.25
      if (s < lim - 0.25) return { s, kind: '마스크' }
      const prof = []; for (let t = 0.3 * lim; t <= 0.85 * lim; t += 0.5) prof.push([t, lumaAt(c[0] + n[0] * sg * t, c[1] + n[1] * sg * t)])
      if (prof.length < 5) return null
      const sm = prof.map((_, i) => { let q = 0, k = 0; for (let j = -2; j <= 2; j++) { const e = prof[i + j]; if (e) { q += e[1]; k++ } } return q / k })
      let bi = 0; sm.forEach((v, i) => { if (v < sm[bi]) bi = i })
      if (sm[bi] > 0.85 * median(sm)) return null   // 뚜렷하게 어두운 곳이 없으면 못 잡은 것
      return { s: prof[bi][0], kind: '어두움' }
    }
    const rM = side(1, limM), rP = side(-1, limP)
    if (!rM || !rP) return fail
    return { c, n, limM, limP, w: rM.s + rP.s, A: [c[0] - n[0] * rP.s, c[1] - n[1] * rP.s], B: [c[0] + n[0] * rM.s, c[1] + n[1] * rM.s], kindM: rM.kind, kindP: rP.kind }
  }
  const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]]
  function drawDebug() {
    const cv2 = els.debug; if (!cv2) return
    const x = cv2.getContext('2d'), k = cv2.width / IW; x.clearRect(0, 0, cv2.width, cv2.height)
    const L = DEBUG && LMS[cur]; if (!L) return
    const mk = masks.get(frames[cur])
    if (mk) x.drawImage(mk.overlay, 0, 0, cv2.width, cv2.height)
    x.lineCap = 'round'
    x.strokeStyle = '#39d98a'; x.lineWidth = 2 * k
    BONES.forEach(([a, b]) => { if ((a === 13 && b === 14)) return; x.beginPath(); x.moveTo(L[a][0] * k, L[a][1] * k); x.lineTo(L[b][0] * k, L[b][1] * k); x.stroke() })
    x.strokeStyle = '#ff2d2d'; x.lineWidth = 4 * k; x.beginPath(); x.moveTo(L[13][0] * k, L[13][1] * k); x.lineTo(L[14][0] * k, L[14][1] * k); x.stroke()
    const r = mk && meas.get(frames[cur])
    if (r) { // 폭 재기: 소지선~중지선 사이 수직선(노랑) + 경계 두 점(초록) + 폭 숫자
      x.strokeStyle = '#ffd25a'; x.lineWidth = 2 * k; x.beginPath(); x.moveTo((r.c[0] - r.n[0] * r.limP) * k, (r.c[1] - r.n[1] * r.limP) * k); x.lineTo((r.c[0] + r.n[0] * r.limM) * k, (r.c[1] + r.n[1] * r.limM) * k); x.stroke()
      if (r.w != null) {
        ;[r.A, r.B].forEach(p => { x.beginPath(); x.arc(p[0] * k, p[1] * k, 6 * k, 0, TAU); x.fillStyle = '#19d96b'; x.fill(); x.lineWidth = 2 * k; x.strokeStyle = '#fff'; x.stroke() })
      }
      const txt = r.w == null ? '제외' : `${r.w.toFixed(1)}px`
      x.font = `700 ${15 * k}px sans-serif`; x.lineWidth = 4 * k; x.strokeStyle = 'rgba(0,0,0,.75)'; x.fillStyle = '#fff'
      x.strokeText(txt, (r.c[0] + 10) * k, (r.c[1] - 10) * k); x.fillText(txt, (r.c[0] + 10) * k, (r.c[1] - 10) * k)
    }
    L.forEach((p, i) => { const big = i === 13 || i === 14; x.beginPath(); x.arc(p[0] * k, p[1] * k, (big ? 7 : 3) * k, 0, TAU); x.fillStyle = big ? '#ff2d2d' : '#ffffff'; x.fill(); x.lineWidth = 1.2 * k; x.strokeStyle = big ? '#fff' : '#39d98a'; x.stroke() })
  }

  // ---- 무빙원 알: 손가락 축을 따라 돌며 좌우로 미끄러짐
  let slideT = 0
  function slideHead() { const head = S.head, u = head && head.userData; if (!u || !u.slide || !u.q0) return; head.quaternion.copy(u.q0).premultiply(new THREE.Quaternion().setFromAxisAngle(u.axis, u.amp * Math.sin(slideT * 0.9))) }

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
    const keep = { CI: S.CI, WMM: S.WMM, WALL: S.WALL, METAL: S.METAL, PAVE: S.PAVE, GW: S.GW, GEM: S.GEM }; S.scene = tScene; clip.set(new THREE.Vector3(0, 0, 1), 1000)
    renderer.setScissorTest(true); renderer.setViewport(0, 0, SZ / pr, SZ / pr); renderer.setScissor(0, 0, SZ / pr, SZ / pr); renderer.toneMappingExposure = 1.3
    const axis = new THREE.Vector3(0, 0.62, 0.78).normalize()
    CAT.forEach((c, i) => {
      S.CI = i; S.WMM = c.defaultWidth; S.WALL = c.wall; S.METAL = c.metal; S.PAVE = c.id === 'IC' ? 'semi' : 'none'; S.GW = 0; if (c.gem) S.GEM = c.gem; rebuild()
      const Rin = 0.58, pxmm = Rin / (S.FD / 2), pos = new THREE.Vector3(0, c.id === 'SOL' || c.id === 'ND' ? -0.25 : -0.05, 0), { qR, qH } = frameFor(axis, new THREE.Vector3(0, 0.78, -0.62), 0)
      setRing(S.ring, qR, pos, Rin, S.WMM * pxmm, axis, 0, paveCfg())
      const head = S.head
      if (head) { head.quaternion.copy(qH); head.position.copy(pos); head.scale.setScalar(pxmm); head.visible = true }
      renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(tScene, tCam)
      tx.clearRect(0, 0, SZ, SZ); tx.drawImage(cv, 0, cv.height - SZ, SZ, SZ, 0, 0, SZ, SZ); thumbs[c.id] = tc.toDataURL()
    })
    dispose(S.ring); dispose(S.ring2); S.ring = S.ring2 = null; if (S.head) { tScene.remove(S.head); S.head = null }
    S.scene = mainScene; renderer.setScissorTest(false); renderer.setViewport(0, 0, IW, IH)
    Object.assign(S, keep)
    return thumbs
  }

  // 가만히 있어도 반짝이게: 파베 알이 하나씩 반짝이고, 큰 알과 조명이 아주 살짝 움직임 (초당 15번)
  // 손 영상 자동 재생: 앞뒤로 계속 왕복 (초당 10장). 손으로 끌면 멈췄다가 1.5초 뒤 다시 돎
  let lastTw = 0, raf = 0
  function twinkle(now) {
    raf = requestAnimationFrame(twinkle)
    if (AUTO && !document.hidden && dragX === null && now > resumeAt && now - lastPlay > 100) {
      lastPlay = now; let n = cur + playDir
      if (n < PMIN || n > PMAX) { playDir = -playDir; n = Math.max(PMIN, Math.min(PMAX, cur + playDir)) }
      show(n)
    }
    if (document.hidden || now - lastTw < 66 || !S.MASK) return; lastTw = now; const t = now / 1000, head = S.head;
    [S.ring, S.ring2].forEach(g => {
      if (!g) return; const s = g.userData.stones; if (!s.visible || !s.count) return
      for (let c = 0; c < s.count; c++) {
        const ph = (Math.abs(Math.sin(c * 12.9898) * 43758.5453) % 1) * TAU, base = 0.45 + 0.4 * ((Math.abs(Math.sin(c * 7.13) * 9137.1) % 1))
        const k = base + 0.9 * Math.pow(Math.max(0, Math.sin(t * 1.3 + ph)), 12), B = s.userData.base; s.setColorAt(c, B ? TW.setRGB(B[c * 3] * k, B[c * 3 + 1] * k, B[c * 3 + 2] * k) : TW.setScalar(k))
      }
      s.instanceColor.needsUpdate = true
    })
    if (head && head.userData.slide) { slideT = t; slideHead() }
    if (head && head.userData.gem && !head.userData.slide) { const gm = head.userData.gem; gm.rotation.y = 0.06 * Math.sin(t * 0.7); gm.rotation.x = 0.04 * Math.sin(t * 1.1) }
    key.position.set(-0.4 + 0.35 * Math.sin(t * 0.5), 1, 0.8 + 0.2 * Math.cos(t * 0.4))
    renderer.render(S.scene, cam); composite(); shadow()
  }

  setHand(hand); const thumbs = makeThumbs(); rebuild(); show()
  raf = requestAnimationFrame(twinkle)
  return {
    thumbs,
    // 확인용(?pave=full&w=7&frame=41): 반지 옵션을 바꾸고 재생을 멈춰 특정 프레임에 고정
    debug(o: Record<string, any>, frame?: number) { Object.assign(S, o); rebuild(); if (frame != null) { resumeAt = Infinity; show(frame) } else show() },
    // 상세 설정: 현재 고른 옵션 읽기 / 바꾸기 (바꾸면 반지를 다시 만들어 그림)
    state() { const { CI, WMM, WALL, METAL, PAVE, GW, GPAVE, GMETAL, RMETAL, CUT, CT, GEM, PRONG } = S; return { CI, WMM, WALL, METAL, PAVE, GW, GPAVE, GMETAL, RMETAL, CUT, CT, GEM, PRONG } },
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
    setHo(ho: number) { S.HO = ho; S.FD = (40 + ho) / Math.PI; rebuild(); show() },
    stop() { removeEventListener('resize', applyZoom); cancelAnimationFrame(raf); dispose(S.ring); dispose(S.ring2); if (S.head) { S.scene.remove(S.head); S.head = null }; S.ring = S.ring2 = null },
  }
}
