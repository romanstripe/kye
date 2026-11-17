// @ts-nocheck  (반지 목록 썸네일)
import * as THREE from "three";
import { S, IW, IH, LI, cv, renderer, mainScene, clip } from "./shared.ts";
import { STORE_ENV } from "./lights.ts";
import type { RingInfo } from "./types.ts";

type Deps = {
  CAT: RingInfo[];
  ST: { thumbing: boolean };
  rebuild: () => void;
  dispose: (g: any) => void;
  frameFor: (axis: any, nrm: any, bl?: number) => any;
  setRing: (...a: any[]) => void;
  paveCfgOf: (st: any) => any;
};

const THUMB_SIZE = 136; // 썸네일 한 변(px)

// ---- 썸네일: 같은 렌더러로 작은 칸에 반지를 하나씩 그려 이미지로
export function makeThumbs({ CAT, ST, rebuild, dispose, frameFor, setRing, paveCfgOf }: Deps) {

  const thumbs = {};
  const tScene = new THREE.Scene();
  tScene.environment = STORE_ENV;
  tScene.add(new THREE.AmbientLight(0xffffff, 0.25 * LI));
  const tk = new THREE.DirectionalLight(0xffffff, 1.3 * LI);
  tk.position.set(-0.4, 1, 0.8);
  tScene.add(tk);
  const tCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  tCam.position.z = 50;
  const SZ = THUMB_SIZE,
    pr = renderer.getPixelRatio(),
    tc = document.createElement("canvas");
  tc.width = tc.height = SZ;
  const tx = tc.getContext("2d");
  ST.thumbing = true;
  const keep = {
    CI: S.CI,
    WMM: S.WMM,
    WALL: S.WALL,
    METAL: S.METAL,
    PAVE: S.PAVE,
    GW: S.GW,
    GEM: S.GEM,
  };
  S.scene = tScene;
  clip.set(new THREE.Vector3(0, 0, 1), 1000);
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, SZ / pr, SZ / pr);
  renderer.setScissor(0, 0, SZ / pr, SZ / pr);
  renderer.toneMappingExposure = 1.3;
  const axis = new THREE.Vector3(0, 0.62, 0.78).normalize();
  CAT.forEach((c, i) => {
    S.CI = i;
    S.WMM = c.defaultWidth;
    S.WALL = c.wall;
    S.METAL = c.metal;
    S.PAVE = c.id === "IC" ? "semi" : "none";
    S.GW = 0;
    if (c.gem) S.GEM = c.gem;
    rebuild();
    const Rin = 0.58,
      pxmm = Rin / (S.FD / 2),
      pos = new THREE.Vector3(
        0,
        c.id === "SOL" || c.id === "ND" ? -0.25 : -0.05,
        0,
      ),
      { qR, qH } = frameFor(axis, new THREE.Vector3(0, 0.78, -0.62), 0);
    setRing(S.ring, qR, pos, Rin, S.WMM * pxmm, axis, 0, paveCfgOf(S));
    const head = S.head;
    if (head) {
      head.quaternion.copy(qH);
      head.position.copy(pos);
      head.scale.setScalar(pxmm);
      head.visible = true;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(tScene, tCam);
    tx.clearRect(0, 0, SZ, SZ);
    tx.drawImage(cv, 0, cv.height - SZ, SZ, SZ, 0, 0, SZ, SZ);
    thumbs[c.id] = tc.toDataURL();
  });
  dispose(S.ring);
  dispose(S.ring2);
  S.ring = S.ring2 = null;
  if (S.head) {
    tScene.remove(S.head);
    S.head = null;
  }
  S.scene = mainScene;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, IW, IH);
  Object.assign(S, keep);
  ST.thumbing = false;
  return thumbs;
}
