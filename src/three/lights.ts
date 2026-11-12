import * as THREE from 'three'
import { LI, renderer, mainScene, pmg } from './shared.ts'

// ---- 조명 (모듈을 불러오면 메인 장면에 바로 적용됨)
function makeEnv(bg: number, lights: number[][]) {
  const es = new THREE.Scene()
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: bg })))
  lights.forEach(([c, x, y, z, s]: number[]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); es.add(p) })
  return pmg.fromScene(es, 0.02).texture
}
export const STORE_ENV = makeEnv(0x2e2e31, [[0xcfcfcf, 0, 42, 0, 16], [0xffffff, 20, 38, 10, 7], [0xffffff, -20, 38, 10, 7], [0xffffff, 0, 15, 45, 18], [0xffffff, 38, 10, 18, 8], [0xffffff, -38, 10, 18, 8], [0xffffff, -20, 25, -35, 16], [0xeef2ff, 25, -10, 35, 10], [0x8c8a88, 0, -45, 0, 60]])   // 썸네일용
mainScene.environment = makeEnv(0x101211, [[0xffffff, 0, 45, 0, 18], [0xf2f7f5, 30, 40, 0, 10], [0xf2f7f5, -30, 40, 0, 10], [0xe8efed, 0, 12, 45, 10], [0xffffff, -40, 5, -20, 8], [0x2e3432, 0, -45, 0, 60]])   // 손 위 반지용(사무실 조명)
renderer.toneMappingExposure = 1.3
mainScene.add(new THREE.AmbientLight(0xffffff, 0.15 * LI))
const key = new THREE.DirectionalLight(0xf2f6f5, 1.1 * LI); key.position.set(-0.4, 1, 0.8); mainScene.add(key)
const rim = new THREE.DirectionalLight(0xffffff, 0.7 * LI); rim.position.set(0.6, -0.3, -0.2); mainScene.add(rim)   // 뒤쪽 테두리 빛: 반지 가장자리가 밝게 떠서 두께가 보임
