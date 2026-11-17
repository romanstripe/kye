import { S } from "../shared.ts";
import { FINGERS, FINGER_NAME } from "../../hand/width.ts";
import type { RingInfo, StageEls } from "../types.ts";
import type { Pose } from "../../hand/pose.ts";

// ---- 끼운 반지(슬롯): 슬롯마다 3D 객체(objs)와 옵션 상태(st)를 가짐. S 와 S.ring/ring2/head 는 지금 고르는 슬롯(ai)의 것
export const KEYS = [
  "FINGER",
  "GAPMM",
  "CI",
  "WMM",
  "WALL",
  "METAL",
  "PAVE",
  "GW",
  "GPAVE",
  "GMETAL",
  "RMETAL",
  "CUT",
  "CT",
  "GEM",
  "PRONG",
];
export const MAX_PER_FINGER = 3; // 한 손가락에 끼울 수 있는 반지 수
export const MAX_SLOTS = 15; // 전체 반지 수 (5손가락 × 3)

export type Slot = {
  objs: { ring: any; ring2: any; head: any } | null;
  st: any;
};

type Deps = {
  els: StageEls;
  CAT: RingInfo[];
  dispose: (g: any) => void; // 반지 3D 객체를 장면에서 치움
  rebuild: () => void; // 지금 옵션대로 반지를 다시 만들어 현재 슬롯에 담음
  show: () => void;
  poseOf: (f: string) => Pose | null;
  pauseFor: (ms: number) => void; // 자동 재생을 ms 동안 멈춤
};

export function createSlots({ els, CAT, dispose, rebuild, show, poseOf, pauseFor }: Deps) {
  const list: Slot[] = [];
  // ai: 지금 고르는 슬롯 번호 / thumbing: 썸네일 만드는 중 / pickf: 반지 낄 손가락을 고르는 중
  const state = { ai: 0, thumbing: false, pickf: false };

  const snap = () => Object.fromEntries(KEYS.map((k) => [k, (S as Record<string, any>)[k]]));
  const slotList = () =>
    list.map((sl, i) => ({
      id: CAT[sl.st.CI].id,
      active: i === state.ai,
      finger: sl.st.FINGER as string,
    }));
  const notifySlots = () => els.onSlots?.(slotList());
  function activate(i: number) {
    // i 번째 슬롯을 지금 고르는 슬롯으로
    state.ai = i;
    const sl = list[i];
    Object.assign(S, sl.st);
    S.ring = sl.objs!.ring;
    S.ring2 = sl.objs!.ring2;
    S.head = sl.objs!.head;
  }
  // 손가락 고르기: 손가락마다 반지 자리에 ＋ 점을 띄움 (영상은 멈춤). 한 손가락에 최대 3개
  function emitHints() {
    const cnt: Record<string, number> = {};
    list.forEach((sl) => {
      cnt[sl.st.FINGER] = (cnt[sl.st.FINGER] || 0) + 1;
    });
    els.onHints?.(
      state.pickf
        ? FINGERS.filter((f) => (cnt[f] || 0) < MAX_PER_FINGER).flatMap((f) => {
            const pose = poseOf(f);
            return pose ? [{ f, name: FINGER_NAME[f], x: pose[0], y: pose[1] }] : [];
          })
        : [],
    );
  }
  function setPick(on: boolean) {
    state.pickf = on;
    if (!on) pauseFor(800);
    emitHints();
  }
  function switchSlot(i: number) {
    if (i === state.ai || !list[i]) return;
    activate(i);
    notifySlots();
    show();
  }
  function addSlot(finger?: string) {
    // 지금 반지와 같은 설정으로 하나 더 (가드링은 없음으로), 끼울 손가락은 finger
    if (list.length >= MAX_SLOTS) return;
    const st = snap();
    if (
      list.filter((sl) => sl.st.FINGER === (finger ?? st.FINGER)).length >=
      MAX_PER_FINGER
    )
      return; // 한 손가락에 최대 3개
    S.ring = S.ring2 = S.head = null;
    state.ai = list.length;
    list.push({ objs: null, st: null });
    Object.assign(S, st, { GW: 0, FINGER: finger ?? st.FINGER, GAPMM: 2.5 });
    rebuild();
    show();
  }
  function removeSlot(i: number) {
    if (list.length < 2 || !list[i]) return;
    const o = list[i].objs!;
    dispose(o.ring);
    dispose(o.ring2);
    if (o.head) S.scene.remove(o.head);
    list.splice(i, 1);
    activate(Math.min(state.ai > i ? state.ai - 1 : state.ai, list.length - 1));
    notifySlots();
    show();
  }

  return { list, state, snap, slotList, notifySlots, activate, emitHints, setPick, switchSlot, addSlot, removeSlot };
}
