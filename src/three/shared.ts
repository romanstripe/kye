// @ts-nocheck  (원본 데모 를 모양·수치 그대로 옮긴 파일들은 타입 검사를 끔)
// 원본 main13.js 맨 위의 three 설정과 여러 파일이 같이 쓰는 값들.
import * as THREE from 'three'

// 데모는 three r128. r128은 색상 변환이 없고 조명 세기에 π가 곱해져 있었음 → 지금 버전에서 같은 화면이 나오게 맞춤.
THREE.ColorManagement.enabled = false
export const LI = Math.PI   // 점광/방향광/주변광 세기에 곱함

export const IW = 480, IH = 854
export const TAU = Math.PI * 2
export const H = 0.62
export const wrap = (a) => ((a % TAU) + TAU) % TAU

export const cv = document.createElement('canvas')
export const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(IW, IH, false)
renderer.localClippingEnabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25
export const mainScene = new THREE.Scene()
export const cam = new THREE.OrthographicCamera(0, IW, 0, -IH, -1000, 1000); cam.position.z = 400
export const pmg = new THREE.PMREMGenerator(renderer)
export const clip = new THREE.Plane()

export const METALS = { PG: 0xf2b9a2, YG: 0xf0c36e, WG: 0xeef0f3 }
export const M = (c, met, rough) => new THREE.MeshStandardMaterial({ color: c, metalness: met, roughness: rough, clippingPlanes: [clip], side: THREE.DoubleSide })

// 원본의 전역 변수(let)들. 모듈 사이에서 바꿔 써야 해서 한 객체에 모음.
export const S = {
  scene: mainScene,
  HO: 17.5, FD: (40 + 17.5) / Math.PI,   // 호수 → 안쪽 둘레(40+호수 mm) → 지름
  WMM: 4.8, WALL: 1.8, METAL: 'PG', PAVE: 'none', GW: 0, GPAVE: false, GMETAL: 'same', RMETAL: 'same',
  FINGER: 'ring',   // 이 반지를 끼운 손가락
  CUT: 'round', CT: 1, GEM: 'dia', PRONG: 4,
  CI: 0, ring: null, ring2: null, head: null, MASK: null, pxmmNow: 1,
}
