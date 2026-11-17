// @ts-nocheck  (프레임별 피부 마스크와 손가락 폭 측정 캐시)
import { skinMask } from "../hand/skin.ts";
import type { SkinMask } from "../hand/skin.ts";
import { measure } from "../hand/width.ts";
import { computeFixed } from "../hand/fixed.ts";
import type { Fixed } from "../hand/fixed.ts";

// stage 의 현재 손 영상 값 (부를 때마다 지금 것을 읽음)
type Ctx = { frames: string[]; LMS: number[][][]; PMIN: number; PMAX: number };

export function createSkinCache(
  get: () => Ctx,
  jlen: (f: string, i: number) => number,
  // 마스크·폭 하나가 계산될 때마다 부름. justFixed: 이번에 처음 고정 폭이 정해짐
  onDone: (url: string, justFixed: boolean) => void,
) {
  const masks = new Map<string, SkinMask>(),
    meas = new Map<string, any>(),
    inflight = new Map<string, Promise<void>>();
  let warmId = 0; // 손 영상이 바뀌면 올라가서, 이전 영상의 계산 결과를 버림
  const c = {
    masks,
    meas,
    fixed: null as Fixed | null, // 손가락별 고정 폭 등 (hand/fixed.ts)
    reset() {
      c.fixed = null;
      masks.clear();
      meas.clear();
      inflight.clear();
      warmId++;
    },
    // 재생 구간을 다 재고 나면 손가락마다 폭 등을 하나로 고정 (계산은 hand/fixed.ts). 이번에 처음 고정됐으면 true
    refix() {
      if (c.fixed) return false;
      const { frames, LMS, PMIN, PMAX } = get();
      c.fixed = computeFixed(meas, frames, LMS, jlen, PMIN, PMAX);
      return !!c.fixed;
    },
    // 프레임 i 의 마스크와 폭을 (아직 없으면) 계산
    ensureMask(i: number) {
      const { frames, LMS } = get();
      const url = frames[i];
      if (!url || masks.has(url)) return Promise.resolve();
      let p = inflight.get(url);
      if (!p) {
        const id = warmId;
        p = skinMask(url)
          .then((m) => {
            if (id !== warmId) return;
            masks.set(url, m);
            const L = LMS[i];
            if (L) meas.set(url, measure(L, m));
            onDone(url, c.refix());
          })
          .catch(() => {})
          .finally(() => inflight.delete(url));
        inflight.set(url, p);
      }
      return p;
    },
    // 재생 구간 전체를 미리 계산
    async warm() {
      const id = warmId;
      const { PMIN, PMAX } = get();
      for (let i = PMIN; i <= PMAX && id === warmId; i++) await c.ensureMask(i);
    },
  };
  return c;
}
