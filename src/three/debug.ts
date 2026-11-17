// @ts-nocheck  (디버그 그림 · 측정 리포트 · 그리기 시간)
import { FINGERS } from "../hand/width.ts";
import { fingerLine as fingerLineOf, whyLine as whyLineOf, ratioLine } from "../hand/report.ts";
import { drawHandDebug } from "./debugDraw.ts";
import type { Fixed } from "../hand/fixed.ts";
import type { SkinMask } from "../hand/skin.ts";
import type { StageEls } from "./types.ts";

// 디버그가 그때그때 읽어 가는 stage 의 현재 값
type Ctx = {
  frames: string[];
  LMS: number[][][];
  cur: number;
  PMIN: number;
  PMAX: number;
  masks: Map<string, SkinMask>;
  meas: Map<string, any>;
  fixed: Fixed | null;
  usedW: number | null;
  outerPx: number | null;
};

export function createDebug(els: StageEls, get: () => Ctx, poseOf: (f: string) => number[] | null) {
  // 디버그 단계: on 꺼짐 / text=true 그림 + 설명 글자 / text=false 그림만
  // 디버그: MediaPipe 21점과 뼈대 선. 약지 13·14번 점과 13→14 선은 빨간색으로 크게
  // + 피부 마스크(반투명 빨강) + 약지 폭 재기(소지선 17→18 ~ 중지선 9→10 사이)
  const state = { on: false, text: false };

  // 한 프레임 그리는 시간(ms): show 는 반지 놓기부터 그림자까지, 반짝임 갱신은 그리기부터 그림자까지. 최근 30번을 디버그에 보여줌
  const drawMs: number[] = [];
  const lap = (t0: number) => {
    drawMs.push(performance.now() - t0);
    if (drawMs.length > 30) drawMs.shift();
  };

  // 내 영상: 폭 재는 중 / 실패 / (디버그) 고정 폭과 반지 크기
  // 손가락별: 재생 구간에서 양쪽 경계가 잡힌 프레임들의 폭 가운데값(잰 프레임 수)
  let fingerMemo: { n: number; txt: string } | null = null; // 측정 개수가 같으면 다시 계산하지 않음 (끝나면 그대로)
  const resetMemo = () => {
    fingerMemo = null;
  };
  function fingerLine() {
    const { meas, frames, PMIN, PMAX } = get();
    if (fingerMemo && fingerMemo.n === meas.size) return fingerMemo.txt;
    const txt = fingerLineOf(meas, frames, PMIN, PMAX);
    fingerMemo = { n: meas.size, txt };
    return txt;
  }
  const msLine = () =>
    drawMs.length
      ? `\n그리기 ${(drawMs.reduce((a, b) => a + b, 0) / drawMs.length).toFixed(1)}ms (최근 ${drawMs.length}번 평균, 최대 ${Math.max(...drawMs).toFixed(1)}ms)`
      : "";
  function reportMine(say: (s: string) => void) {
    const { meas, frames, PMIN, PMAX, fixed, usedW, outerPx } = get();
    const total = PMAX - PMIN + 1;
    let done = 0;
    for (let i = PMIN; i <= PMAX; i++) if (meas.get(frames[i])) done++;
    if (!fixed) {
      say(`약지 폭 재는 중 ${done}/${total}`);
      return;
    }
    const fr = fixed.ring;
    if (!fr.n) {
      say("약지 폭을 못 쟀어요 (양쪽 경계가 잡힌 프레임이 없어요)");
      return;
    }
    if (!state.on || !state.text) {
      say("");
      return;
    }
    say(`잰 프레임 ${fr.n}/${total} · 고정 폭 ${fr.W.toFixed(1)}px · 이 프레임에 쓴 폭 ${usedW != null ? usedW.toFixed(1) : "-"}px · 반지 바깥 지름 ${outerPx != null ? outerPx.toFixed(1) : "-"}px
${fingerLine()}${ratioLine(Object.fromEntries(FINGERS.map((f) => [f, poseOf(f)])))}${whyLineOf(meas, frames, PMIN, PMAX)}${msLine()}`);
  }
  function report() {
    if (els.onInfo) reportMine(els.onInfo);
  }
  function drawDebug() {
    const cv2 = els.debug;
    if (!cv2) return;
    const { LMS, cur, frames, masks, meas } = get();
    const L = state.on && LMS[cur];
    if (!L) {
      cv2.getContext("2d").clearRect(0, 0, cv2.width, cv2.height);
      return;
    }
    drawHandDebug(
      cv2,
      L,
      masks.get(frames[cur]),
      meas.get(frames[cur]),
      Object.fromEntries(FINGERS.map((f) => [f, poseOf(f)])),
    );
  }

  return { state, lap, resetMemo, report, drawDebug };
}
