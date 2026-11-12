// @ts-nocheck
import * as THREE from 'three'
import { mainScene } from './shared.ts'

// 안 보이는 3D 손 견본(깊이만): 손가락 뒤로 가는 반지 부분을 가림
const occMat = new THREE.MeshBasicMaterial({ colorWrite: false })
export const SEGS = [[13, 14, 0.92], [14, 15, 0.88], [15, 16, 0.8], [9, 10, 1.0], [10, 11, 0.95], [11, 12, 0.85], [17, 18, 0.85], [18, 19, 0.8], [19, 20, 0.72], [5, 6, 1.0], [6, 7, 0.95], [7, 8, 0.85], [0, 9, 1.6], [0, 13, 1.6], [0, 17, 1.5], [0, 5, 1.6]]
export const occ = SEGS.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false), occMat); m.renderOrder = -1; mainScene.add(m); return m })
export const JI = [13, 14, 15, 9, 10, 11, 17, 18, 19, 5, 6, 7]
export const occJ = JI.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), occMat); m.renderOrder = -1; mainScene.add(m); return m })
