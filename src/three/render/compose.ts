import * as THREE from "three";
import { IW, cv } from "../shared.ts";
import { SEGS, occ, JI, occJ } from "./occluders.ts";
import type { StageEls } from "../types.ts";

// 반지 크기·자리는 보정 없이, 잰 손가락 폭으로 결정
export const FEATHER = 0.8,
  OCCK = 0.89;
export const V = (L: number[][], i: number) => new THREE.Vector3(L[i][0], -L[i][1], -L[i][2]);

export function placeOcc(L: number[][], rad: number) {
  SEGS.forEach(([i, j, k], n) => {
    const a = V(L, i),
      b = V(L, j),
      m = occ[n],
      d = b.clone().sub(a),
      len = d.length();
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.scale.set(rad * k, len, rad * k);
    m.visible = true;
  });
  JI.forEach((i, n) => {
    occJ[n].position.copy(V(L, i));
    occJ[n].scale.setScalar(rad * 0.9);
    occJ[n].visible = true;
  });
}
export function hideOcc() {
  occ.forEach((m) => (m.visible = false));
  occJ.forEach((m) => (m.visible = false));
}

// 반지마다 자를 영역: 중심(cx,cy), 손가락 방향(ux,uy), 반 폭 hw, 반 길이 hl
export type Mask = { cx: number; cy: number; ux: number; uy: number; hw: number; hl: number };

export function createCompose(els: StageEls) {
  const { shadow: sh, out: outc } = els;
  const sx2 = sh.getContext("2d")!,
    ox = outc.getContext("2d")!;
  // 캔버스 크기는 달라졌을 때만 바꿈 (width 를 다시 쓰면 매번 메모리를 새로 잡고 지워서 느림)
  const fit = (c: HTMLCanvasElement) => {
    if (c.width !== cv.width || c.height !== cv.height) {
      c.width = cv.width;
      c.height = cv.height;
    }
  };
  const maskCv = document.createElement("canvas");
  function composite(MASKS: Mask[]) {
    fit(outc);
    const k = cv.width / IW;
    ox.clearRect(0, 0, outc.width, outc.height);
    if (!MASKS.length) return;
    ox.drawImage(cv, 0, 0);
    fit(maskCv);
    const mx = maskCv.getContext("2d")!;
    mx.clearRect(0, 0, maskCv.width, maskCv.height);
    mx.fillStyle = "#000"; // 반지마다 자를 영역을 모두 합쳐서 한 번에 자름
    MASKS.forEach(({ cx, cy, ux, uy, hw, hl }) => {
      const px = -uy,
        py = ux;
      mx.beginPath();
      [
        [hl, hw],
        [hl, -hw],
        [-hl, -hw],
        [-hl, hw],
      ].forEach(([a, b], i) => {
        const X = (cx + ux * a + px * b) * k,
          Y = (cy + uy * a + py * b) * k;
        i ? mx.lineTo(X, Y) : mx.moveTo(X, Y);
      });
      mx.closePath();
      mx.fill();
    });
    ox.globalCompositeOperation = "destination-in";
    ox.filter = `blur(${FEATHER * k}px)`;
    ox.drawImage(maskCv, 0, 0);
    ox.filter = "none";
    ox.globalCompositeOperation = "source-over";
  }
  const tmp = document.createElement("canvas");
  function shadow() {
    fit(sh);
    const k = cv.width / IW;
    sx2.clearRect(0, 0, sh.width, sh.height);
    // 그림자 두 겹: 넓고 옅은 그림자(공중에 뜬 느낌 지움) + 반지가 피부에 닿는 곳의 짙고 좁은 접촉 그림자
    fit(tmp);
    const tx = tmp.getContext("2d")!;
    ([
      [7, 2, 4, "rgba(70,40,32,0.32)"],
      [1.6, 0.6, 1.4, "rgba(45,25,20,0.75)"],
    ] as [number, number, number, string][]).forEach(([bl, dx, dy, col]) => {
      tx.clearRect(0, 0, tmp.width, tmp.height);
      tx.filter = `blur(${bl * k}px)`;
      tx.drawImage(outc, dx * k, dy * k);
      tx.filter = "none";
      tx.globalCompositeOperation = "source-in";
      tx.fillStyle = col;
      tx.fillRect(0, 0, tmp.width, tmp.height);
      tx.globalCompositeOperation = "source-over";
      sx2.drawImage(tmp, 0, 0);
    });
  }
  return { composite, shadow };
}
