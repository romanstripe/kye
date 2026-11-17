import * as THREE from "three";
import { TAU } from "../shared.ts";
import { TW } from "../ring/makeRing.ts";
import type { Slot } from "./slots.ts";

// ---- 무빙원 알: 손가락 축을 따라 돌며 좌우로 미끄러짐 (t: 초 단위 시간)
export function slideHead(head: THREE.Object3D | null | undefined, t: number) {
  const u = head && head.userData;
  if (!u || !u.slide || !u.q0) return;
  head.quaternion
    .copy(u.q0)
    .premultiply(
      new THREE.Quaternion().setFromAxisAngle(u.axis, u.amp * Math.sin(t * 0.9)),
    );
}

// 슬롯들의 3D 객체(os)에 반짝임과 흔들림을 입힘
export function twinkleObjs(os: NonNullable<Slot["objs"]>[], t: number) {
  os.flatMap((o) => [o.ring, o.ring2]).forEach((g) => {
    if (!g) return;
    const s = g.userData.stones;
    if (!s.visible || !s.count) return;
    for (let c = 0; c < s.count; c++) {
      const ph = (Math.abs(Math.sin(c * 12.9898) * 43758.5453) % 1) * TAU,
        base = 0.45 + 0.4 * (Math.abs(Math.sin(c * 7.13) * 9137.1) % 1);
      const k = base + 0.65 * Math.pow(Math.max(0, Math.sin(t * 1.3 + ph)), 12),
        B = s.userData.base;
      s.setColorAt(
        c,
        B
          ? TW.setRGB(B[c * 3] * k, B[c * 3 + 1] * k, B[c * 3 + 2] * k)
          : TW.setScalar(k),
      );
    }
    s.instanceColor.needsUpdate = true;
  });
  os.forEach(({ head }) => {
    if (head && head.userData.slide) slideHead(head, t);
    if (head && head.userData.gem && !head.userData.slide) {
      const gm = head.userData.gem;
      gm.rotation.y = 0.06 * Math.sin(t * 0.7);
      gm.rotation.x = 0.04 * Math.sin(t * 1.1);
    }
  });
}
