// @ts-nocheck  (reference/main13.js 의 조명·배치·합성·반짝임을 모양·수치 그대로 옮김. 손 사진은 한 장(frame 41)만 씀)
import * as THREE from 'three'
import { S, M, H, TAU, IW, IH, LI, cv, renderer, mainScene, cam, pmg, clip } from './shared.ts'
import { GEMS, NUDO_GEMS, makeHead } from './sol.ts'
import { makeRing, TW } from './makeRing.ts'
import { layoutStones } from './layoutStones.ts'
import { makeSlider, makeNudo } from './heads.ts'
import { PAVE_CFG } from './pave.ts'

export type RingInfo = {
  id: string; cat: string; name: string; sub: string; ws: number[]; wl?: Record<string, string>; dw?: number
  wall: number; metal: string | null; diy?: boolean; gemPick?: boolean; gem?: string; pave: { semi?: string; full?: string }
}
// frames: 프레임 이미지 주소, P/LMS: 프레임별 손 좌표, pmin~pmax: 왕복 재생할 구간
export type HandData = { N: number; P: (number[] | null)[]; LMS: number[][][]; frames: string[]; pmin: number; pmax: number }
export type StageEls = { img: HTMLImageElement; tint: HTMLElement; shadow: HTMLCanvasElement; out: HTMLCanvasElement }

// ---- 조명 (원본 main13.js 14~30행)
function makeEnv(bg, lights) {
  const es = new THREE.Scene()
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: bg })))
  lights.forEach(([c, x, y, z, s]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); es.add(p) })
  return pmg.fromScene(es, 0.02).texture
}
const LIGHTS = {
  store: { env: makeEnv(0x2e2e31, [[0xcfcfcf, 0, 42, 0, 16], [0xffffff, 20, 38, 10, 7], [0xffffff, -20, 38, 10, 7], [0xffffff, 0, 15, 45, 18], [0xffffff, 38, 10, 18, 8], [0xffffff, -38, 10, 18, 8], [0xffffff, -20, 25, -35, 16], [0xeef2ff, 25, -10, 35, 10], [0x8c8a88, 0, -45, 0, 60]]),
    exp: 1.35, key: [0xffffff, 1.6], img: 'brightness(1.05) contrast(1.03)', tint: 'rgba(255,255,255,0.05)', blend: 'screen' },
  sun: { env: makeEnv(0x24190f, [[0xffd49a, 45, 15, 10, 40], [0xffe2b8, 0, 40, 0, 30], [0xbfd2ff, -40, 30, 0, 20], [0x6b5a46, 0, -45, 0, 60]]),
    exp: 1.2, key: [0xffd6a0, 1.4], img: 'saturate(1.05) brightness(1.03)', tint: 'rgba(255,190,120,0.10)', blend: 'soft-light' },
  office: { env: makeEnv(0x101211, [[0xffffff, 0, 45, 0, 18], [0xf2f7f5, 30, 40, 0, 10], [0xf2f7f5, -30, 40, 0, 10], [0xe8efed, 0, 12, 45, 10], [0xffffff, -40, 5, -20, 8], [0x2e3432, 0, -45, 0, 60]]),
    exp: 1.3, key: [0xf2f6f5, 1.1], img: 'none', tint: 'transparent', blend: 'normal' },
}
mainScene.add(new THREE.AmbientLight(0xffffff, 0.15 * LI))
const key = new THREE.DirectionalLight(0xffffff, 1.1 * LI); key.position.set(-0.4, 1, 0.8); mainScene.add(key)
const rim = new THREE.DirectionalLight(0xffffff, 0.7 * LI); rim.position.set(0.6, -0.3, -0.2); mainScene.add(rim)   // 뒤쪽 테두리 빛: 반지 가장자리가 밝게 떠서 두께가 보임

// 안 보이는 3D 손 견본(깊이만): 손가락 뒤로 가는 반지 부분을 가림
const occMat = new THREE.MeshBasicMaterial({ colorWrite: false })
const SEGS = [[13, 14, 0.92], [14, 15, 0.88], [15, 16, 0.8], [9, 10, 1.0], [10, 11, 0.95], [11, 12, 0.85], [17, 18, 0.85], [18, 19, 0.8], [19, 20, 0.72], [5, 6, 1.0], [6, 7, 0.95], [7, 8, 0.85], [0, 9, 1.6], [0, 13, 1.6], [0, 17, 1.5], [0, 5, 1.6]]
const occ = SEGS.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false), occMat); m.renderOrder = -1; mainScene.add(m); return m })
const JI = [13, 14, 15, 9, 10, 11, 17, 18, 19, 5, 6, 7]
const occJ = JI.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), occMat); m.renderOrder = -1; mainScene.add(m); return m })

export function createStage(els: StageEls, CAT: RingInfo[], hand: HandData) {
  const { img, tint, shadow: sh, out: outc } = els
  const sx2 = sh.getContext('2d'), ox = outc.getContext('2d')
  let N = 0, P = [], LMS = [], frames = [], PMIN = 0, PMAX = 0, cur = 0
  let playDir = -1, lastPlay = 0, resumeAt = 0, dragX = null, dragY = 0, drag0 = 0
  function setHand(h) {
    N = h.N; P = h.P; LMS = h.LMS; frames = h.frames; PMIN = h.pmin; PMAX = h.pmax
    frames.forEach(u => { new Image().src = u })   // 미리 받아두기
    cur = PMAX; playDir = -1; resumeAt = 0; dragX = null
  }

  let LIGHT = 'office'
  function applyLight() {
    const L = LIGHTS[LIGHT]; mainScene.environment = L.env; renderer.toneMappingExposure = L.exp; key.color.setHex(L.key[0]); key.intensity = L.key[1] * LI
    img.style.filter = L.img; tint.style.background = L.tint; tint.style.mixBlendMode = L.blend
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
  function paveCfg() { const c = CAT[S.CI]; const f = PAVE_CFG[c.id]?.[S.PAVE]; return S.PAVE !== 'none' && f ? f(S.WMM) : null }

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
    if (!p) { [ring, ring2].forEach(g => { if (g) { g.visible = false; g.userData.stones.visible = false } }); if (S.head) S.head.visible = false; S.MASK = null; hideOcc(); return }
    const [cx, cy, cz, dx, dy, dz, fr] = p
    const FD = S.FD, GW = S.GW, WMM = S.WMM, head = S.head
    const axis = new THREE.Vector3(dx, -dy, -dz * DZK).normalize(), pos = new THREE.Vector3(cx, -cy, -cz)
    const frK = fr * FRK, pxmm = 2 * frK / FD; S.pxmmNow = pxmm; const Rin = frK, bandW = WMM * pxmm, W2 = GW * pxmm, gap = 0.2 * pxmm
    const { qR, qH } = frameFor(axis, dorsal(cur))
    pos.add(new THREE.Vector3(1, 0, 0).applyQuaternion(qR).multiplyScalar(Rin * LSH))   // LSH: 반지를 손가락 옆 방향으로 살짝 옮김 (이 영상에서 왼쪽으로 치우쳐 보여서)
    setRing(ring, qR, pos, Rin, bandW, axis, 0, paveCfg(), SQZ)
    if (ring2) setRing(ring2, qR, pos, Rin, W2, axis, bandW / 2 + gap + W2 / 2, S.GPAVE ? { ys: [0], arc: 1, d: GW * 0.75 } : null, SQZ)
    { const L = LMS[cur]; OX = cx - (L[13][0] + L[14][0]) / 2; OY = cy - (L[13][1] + L[14][1]) / 2 }
    placeOcc(LMS[cur], frK * OCCK)
    const t = ring.userData.t, u2 = Math.hypot(dx, dy) || 1
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
    place(P[cur]); renderer.render(S.scene, cam); composite(); shadow()
  }

  // ---- 무빙원 알: 손가락 축을 따라 돌며 좌우로 미끄러짐
  let slideT = 0
  function slideHead() { const head = S.head, u = head && head.userData; if (!u || !u.slide || !u.q0) return; head.quaternion.copy(u.q0).premultiply(new THREE.Quaternion().setFromAxisAngle(u.axis, u.amp * Math.sin(slideT * 0.9))) }

  function pickRing(i) {
    if (i === S.CI && S.ring) return
    S.CI = i; const c = CAT[i]; S.WMM = c.ws[c.dw || 0]; S.WALL = c.wall; S.METAL = c.metal; S.PAVE = 'none'
    if (c.gem) S.GEM = c.gem; else if (c.id === 'SOL' && NUDO_GEMS.includes(S.GEM)) S.GEM = 'dia'
    rebuild(); show()
  }

  // ---- 썸네일: 같은 렌더러로 작은 칸에 반지를 하나씩 그려 이미지로
  function makeThumbs() {
    const thumbs = {}
    const tScene = new THREE.Scene(); tScene.environment = LIGHTS.store.env; tScene.add(new THREE.AmbientLight(0xffffff, 0.25 * LI))
    const tk = new THREE.DirectionalLight(0xffffff, 1.3 * LI); tk.position.set(-0.4, 1, 0.8); tScene.add(tk)
    const tCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100); tCam.position.z = 50
    const SZ = 136, pr = renderer.getPixelRatio(), tc = document.createElement('canvas'); tc.width = tc.height = SZ; const tx = tc.getContext('2d')
    const keep = { CI: S.CI, WMM: S.WMM, WALL: S.WALL, METAL: S.METAL, PAVE: S.PAVE, GW: S.GW, GEM: S.GEM }; S.scene = tScene; clip.set(new THREE.Vector3(0, 0, 1), 1000)
    renderer.setScissorTest(true); renderer.setViewport(0, 0, SZ / pr, SZ / pr); renderer.setScissor(0, 0, SZ / pr, SZ / pr); renderer.toneMappingExposure = 1.3
    const axis = new THREE.Vector3(0, 0.62, 0.78).normalize()
    CAT.forEach((c, i) => {
      S.CI = i; S.WMM = c.ws[c.dw || 0]; S.WALL = c.wall; S.METAL = c.metal; S.PAVE = c.id === 'IC' ? 'semi' : 'none'; S.GW = 0; if (c.gem) S.GEM = c.gem; rebuild()
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
    if (!document.hidden && dragX === null && now > resumeAt && now - lastPlay > 100) {
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

  setHand(hand); applyLight(); const thumbs = makeThumbs(); rebuild(); show()
  raf = requestAnimationFrame(twinkle)
  return {
    thumbs,
    setHand(h: HandData) { setHand(h); show(PMAX) },
    dragStart(x: number, y: number) { dragX = x; dragY = y; drag0 = cur },
    dragMove(x: number, y: number, w: number) {
      if (dragX === null) return
      const dx = x - dragX, dy = dragY - y
      show(drag0 + (Math.abs(dy) > Math.abs(dx) ? dy : dx) / (w || 300) * N * 1.2)
    },
    dragEnd() { dragX = null; resumeAt = performance.now() + 1500 },
    pick(id: string) { const i = CAT.findIndex(c => c.id === id); if (i >= 0) pickRing(i) },
    stop() { cancelAnimationFrame(raf); dispose(S.ring); dispose(S.ring2); if (S.head) { S.scene.remove(S.head); S.head = null }; S.ring = S.ring2 = null },
  }
}
