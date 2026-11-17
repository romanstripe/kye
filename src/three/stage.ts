// @ts-nocheck  (조명·배치·합성·반짝임)
import * as THREE from "three";
import {
  S,
  H,
  IW,
  IH,
  cv,
  renderer,
  cam,
  clip,
} from "./shared.ts";
import { NUDO_GEMS, makeHead } from "./sol.ts";
import { makeRing } from "./makeRing.ts";
import { layoutStones } from "./layoutStones.ts";
import { createSlots } from "./slots.ts";
import { makeThumbs } from "./thumbs.ts";
import { slideHead, twinkleObjs } from "./twinkle.ts";
import { makeSlider, makeNudo } from "./heads.ts";
import { occ, occJ } from "./occluders.ts";
import { JOINT } from "../hand/width.ts";
import { ringPoseOf } from "../hand/pose.ts";
import { createDebug } from "./debug.ts";
import { createSkinCache } from "./skinCache.ts";
import { createCompose, placeOcc, hideOcc, V, OCCK } from "./compose.ts";
import { smoothLandmarks } from "../hand/smooth.ts";

import type { RingInfo, HandData, StageEls } from "./types.ts";

const TWINKLE_MS = 66; // 반짝임·흔들림 갱신 간격(ms)

export function createStage(els: StageEls, CAT: RingInfo[], hand: HandData) {
  const { img } = els;
  clip.set(new THREE.Vector3(0, 0, 1), 1000); // 재질에 달린 잘라내기 평면은 멀리 둠 (손가락별 평면은 renderMain 에서)
  let N = 0,
    P = [],
    LMS = [],
    SM = [],
    frames = [],
    PMIN = 0,
    PMAX = 0,
    cur = 0;
  let AUTO = true; // 자동 재생

  let playDir = -1,
    lastPlay = 0,
    resumeAt = 0,
    dragX = null,
    dragY = 0,
    drag0 = 0;
  function setHand(h) {
    N = h.N;
    P = h.P;
    LMS = h.LMS;
    SM = smoothLandmarks(LMS);
    frames = h.frames;
    PMIN = h.pmin;
    PMAX = h.pmax;
    mc.reset();
    cur = PMAX;
    playDir = -1;
    resumeAt = 0;
    dragX = null;
    dbg.resetMemo();
    warm();
    report(); // 손 영상을 불러오면 재생 구간의 다섯 손가락 폭을 미리 재 둠 (끝나면 다시 재지 않음)
  }

  function ringWall() {
    const c = CAT[S.CI];
    return c.diy ? S.WALL : c.wall;
  }
  function dispose(g) {
    if (!g) return;
    S.scene.remove(g);
    S.scene.remove(g.userData.stones);
  }
  function rebuild() {
    dispose(S.ring);
    dispose(S.ring2);
    if (S.head) {
      S.scene.remove(S.head);
      S.head = null;
    }
    const c = CAT[S.CI];
    S.ring = makeRing(c.id, ringWall(), S.METAL, S.WMM);
    if (c.id === "SOL") S.head = makeHead(Math.min(ringWall(), 1.6), S.METAL);
    if (c.id === "MV") S.head = makeSlider(0.0, S.METAL);
    if (c.id === "ND") S.head = makeNudo(ringWall(), S.METAL, S.WMM);
    S.ring2 =
      S.GW > 0
        ? makeRing(
            "S",
            Math.min(ringWall(), 1.5),
            S.GMETAL === "same" ? S.METAL || "YG" : S.GMETAL,
            S.GW,
          )
        : null;
    if (!ST.thumbing) {
      SLOTS[ST.ai] ??= { objs: null, st: null };
      SLOTS[ST.ai].objs = { ring: S.ring, ring2: S.ring2, head: S.head };
      SLOTS[ST.ai].st = snap();
      notifySlots();
    }
  }

  const slots = createSlots({
    els,
    CAT,
    dispose,
    rebuild,
    show,
    poseOf,
    pauseFor: (ms) => {
      resumeAt = performance.now() + ms;
    },
  });
  const { list: SLOTS, state: ST, snap, slotList, notifySlots, activate, emitHints, setPick, switchSlot, addSlot, removeSlot } = slots;
  let MASKS: any[] = [];

  // 파베 설정은 rings.json 에서 읽음. layoutStones 가 ys 배열 등을 건드리므로 매번 복사해서 넘김
  function paveCfgOf(st) {
    const c = CAT[st.CI];
    const v =
      st.PAVE !== "none" && c.pave?.[st.PAVE]?.byWidth?.[String(st.WMM)];
    return v ? structuredClone(v) : null;
  }

  // 반지 놓기: 로컬 y = 손가락 축, 로컬 +z = 손등 쪽
  function setRing(g, q, pos, Rin, bandW, axis, off, cfg, sx = 1) {
    // sx: 화면에서 손가락 옆 방향으로만 조임 (반지 모양은 그대로 둥글게)
    g.visible = true;
    g.quaternion.copy(q);
    g.scale.set(Rin, bandW / H, Rin);
    g.position.copy(pos).add(axis.clone().multiplyScalar(off));
    const s = g.userData.stones;
    s.visible = !!cfg;
    if (cfg) {
      layoutStones(g, cfg, bandW / H / Rin);
      s.scale.setScalar(Rin);
      s.quaternion.copy(q);
      s.position.copy(g.position);
    }
    [g, s].forEach((o) => {
      o.matrixAutoUpdate = sx === 1;
      o.updateMatrix();
    });
    if (sx !== 1) {
      // 화면 평면에서 손가락 축에 수직인 방향 L로만 sx배 (카메라 쪽 깊이는 건드리지 않아 옆으로 돌아도 납작해지지 않음)
      const a = new THREE.Vector2(axis.x, axis.y).normalize(),
        L = new THREE.Vector3(-a.y, a.x, 0),
        c = g.position;
      const Sm = new THREE.Matrix4().set(
        1 + (sx - 1) * L.x * L.x,
        (sx - 1) * L.x * L.y,
        0,
        0,
        (sx - 1) * L.y * L.x,
        1 + (sx - 1) * L.y * L.y,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
      );
      const W = new THREE.Matrix4()
        .makeTranslation(c.x, c.y, c.z)
        .multiply(Sm)
        .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
      [g, s].forEach((o) => {
        o.matrix.premultiply(W);
      });
    }
  }

  function dorsal(i) {
    const s = new THREE.Vector3();
    for (let k = -2; k <= 2; k++) {
      const L = LMS[Math.max(0, Math.min(N - 1, i + k))];
      if (!L) continue;
      const a = V(L, 5).sub(V(L, 0)),
        b = V(L, 17).sub(V(L, 0));
      s.add(a.cross(b).normalize());
    }
    const Lr = LMS[PMAX],
      ref = V(Lr, 5)
        .sub(V(Lr, 0))
        .cross(V(Lr, 17).sub(V(Lr, 0)));
    if (ref.z < 0) s.negate();
    return s.normalize();
  }
  function frameFor(axis, nrm, bl = 0.4) {
    // 손등 방향(축에 수직) 구하고 회전 만들기
    const Y = nrm.clone().sub(axis.clone().multiplyScalar(nrm.dot(axis)));
    const camv = new THREE.Vector3(0, 0, 1).sub(
      axis.clone().multiplyScalar(axis.z),
    );
    Y.normalize()
      .multiplyScalar(1 - bl)
      .add(camv.normalize().multiplyScalar(bl))
      .normalize();
    const qR = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3().crossVectors(axis, Y),
        axis,
        Y,
      ),
    );
    const Z = axis.clone().negate(),
      qH = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          new THREE.Vector3().crossVectors(Y, Z),
          Y,
          Z,
        ),
      );
    return { qR, qH };
  }
  // 손가락별 관절 길이(px): 프레임 i 의 5프레임 평균 점에서 시작 관절→다음 관절의 화면 거리
  const jlen = (f, i) => {
    const L = SM[i];
    if (!L) return 0;
    const [a, b] = JOINT[f];
    return Math.hypot(L[b][0] - L[a][0], L[b][1] - L[a][1]);
  };
  function poseOf(f) {
    // 반지 자리·방향·크기는 모두 5프레임 평균 낸 점(SM)에서 계산 (hand/pose.ts). 원래 점(LMS)은 폭 재기·디버그 그리기용
    const L = SM[cur];
    if (!L) return null;
    return ringPoseOf(f, L, mc.fixed?.[f], SLOTS.find((sl) => sl.st.FINGER === f)?.st.WMM ?? 0, S.FD, meas.get(frames[cur])?.[f]?.webT ?? null);
  }
  function hideAll() {
    SLOTS.forEach(({ objs: o }) => {
      if (!o) return;
      [o.ring, o.ring2].forEach((g) => {
        if (g) {
          g.visible = false;
          g.userData.stones.visible = false;
        }
      });
      if (o.head) o.head.visible = false;
    });
  }
  function place() {
    hideAll();
    MASKS = [];
    CLIPS = {};
    const used = [...new Set(SLOTS.map((sl) => sl.st.FINGER as string))];
    const poses = Object.fromEntries(used.map((f) => [f, poseOf(f)]));
    const refF = poseOf("ring") ? "ring" : used.find((f) => poses[f]); // 가림 원통·잘라내기 평면 기준 손가락 (약지가 있으면 약지)
    if (!refF) {
      usedW = null;
      outerPx = null;
      S.MASK = null;
      hideOcc();
      return;
    }
    if (!poses[refF]) poses[refF] = poseOf(refF);
    const FD = S.FD,
      qd = dorsal(cur);
    let ref = null;
    used.forEach((f) => {
      const pf = poses[f];
      if (!pf) return;
      const [cx, cy, cz, dx, dy, dz, fr] = pf;
      const axis = new THREE.Vector3(dx, -dy, dz).normalize(),
        pos = new THREE.Vector3(cx, -cy, -cz);
      const frK = fr,
        pxmm = (2 * frK) / FD,
        Rin = frK,
        gap = 0.2 * pxmm;
      const { qR, qH } = frameFor(axis, qd, 0.1); // 손이 돈 만큼보다 조금 더 돌려서 알의 옆면(크라운·발)이 보이게
      const u2 = Math.hypot(dx, dy) || 1;
      if (f === refF) ref = { frK, cx, cy };
      // 이 손가락의 뒤쪽 잘라내기 평면: 관절 방향(축)에 수직인 면 중 카메라 쪽 방향, 반지 중심에서 살짝 뒤. 같은 손가락에 여러 개 끼면 여유를 더 줌
      const nn = new THREE.Vector3(0, 0, 1);
      nn.sub(axis.clone().multiplyScalar(nn.dot(axis)));
      const cnt = SLOTS.filter((sl) => sl.st.FINGER === f).length;
      CLIPS[f] =
        nn.length() < 0.15
          ? new THREE.Plane(new THREE.Vector3(0, 0, 1), 1000)
          : new THREE.Plane().setFromNormalAndCoplanarPoint(
              nn.normalize(),
              pos
                .clone()
                .add(nn.clone().multiplyScalar(-Rin * (cnt > 1 ? 0.6 : 0.15))),
            );
      // 같은 손가락에 낀 반지들: 처음 낀 반지는 제자리, 나중에 낀 반지는 폭 + 앞 반지와의 간격(GAPMM)만큼 손톱 쪽으로 차곡차곡 (위 = 손톱 쪽 = 나중에 낀 반지)
      const idx = SLOTS.map((_, i) => i).filter(
        (i) => SLOTS[i].st.FINGER === f && SLOTS[i].objs,
      );
      let end = 0;
      const offs = idx.map((i, n) => {
        const q = SLOTS[i].st,
          w = q.WMM + (q.GW > 0 ? q.GW + 0.2 : 0),
          o = (n ? end + q.GAPMM : 0) + q.WMM / 2;
        end = (n ? end + q.GAPMM : 0) + w;
        return o;
      });
      SLOTS.forEach((sl, si) => {
        const st = sl.st,
          o = sl.objs;
        if (!o || st.FINGER !== f) return;
        const n = idx.indexOf(si),
          offpx = (offs[n] - offs[0]) * pxmm; // 처음 낀 반지 기준으로 축을 따라 옮길 거리(px)
        const bandW = st.WMM * pxmm,
          W2 = st.GW * pxmm;
        setRing(o.ring, qR, pos, Rin, bandW, axis, offpx, paveCfgOf(st));
        if (o.ring2)
          setRing(
            o.ring2,
            qR,
            pos,
            Rin,
            W2,
            axis,
            offpx + bandW / 2 + gap + W2 / 2,
            st.GPAVE ? { ys: [0], arc: 1, d: st.GW * 0.75 } : null,
          );
        const t = o.ring.userData.t;
        if (si === ST.ai) {
          outerPx = 2 * Rin * (1 + t);
          usedW = fr * 2;
          S.pxmmNow = pxmm;
        }
        const MK = {
          cx: cx + axis.x * offpx,
          cy: cy - axis.y * offpx,
          ux: dx / u2,
          uy: dy / u2,
          hw: Rin * (1 + t * 1.8) + 2 + 0.6 * pxmm,
          hl: bandW + W2 + Rin * 1.5,
        }; // 끝을 자르지 않도록 넉넉하게
        const head = o.head;
        if (head) {
          const qq = head.userData.slide
            ? qR
                .clone()
                .multiply(
                  new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0),
                    Math.PI / 2,
                  ),
                )
            : qH;
          head.quaternion.copy(qq);
          head.userData.q0 = qq.clone();
          head.userData.axis = axis.clone();
          slideHead(head, slideT);
          head.position.copy(pos).add(axis.clone().multiplyScalar(offpx));
          head.scale.setScalar(pxmm);
          head.visible = true;
          MK.hw += (head.userData.top + head.userData.W / 2 - FD / 2) * pxmm;
          MK.hl = Math.max(MK.hl, (head.userData.L / 2 + 1.5) * pxmm * 1.2);
        }
        MASKS.push(MK);
      });
    });
    S.MASK = MASKS[0] || null;
    if (!ref) {
      hideOcc();
      return;
    }
    placeOcc(SM[cur], ref.frK * OCCK);
  }

  // 그리기: 손가락마다 따로 그림 (손가락마다 잘라내기 평면이 달라서). 가림 원통은 깊이만 먼저 한 번 그리고, 반지는 손가락별로
  //  ① 그 손가락 반지만 보이게 ② renderer.clippingPlanes = 그 손가락 평면 ③ render. autoClear 를 꺼서 앞 손가락 그림이 지워지지 않게 함
  let CLIPS: Record<string, any> = {};
  function renderMain() {
    const objs = SLOTS.map((sl) => {
      const o = sl.objs;
      return o
        ? [
            o.ring,
            o.ring?.userData.stones,
            o.ring2,
            o.ring2?.userData.stones,
            o.head,
          ].filter(Boolean)
        : [];
    });
    const was = objs.map((l) => l.map((g) => g.visible)),
      occs = [...occ, ...occJ],
      occWas = occs.map((m) => m.visible);
    renderer.autoClear = false;
    renderer.clippingPlanes = [];
    renderer.clear();
    objs.forEach((l) =>
      l.forEach((g) => {
        g.visible = false;
      }),
    );
    renderer.render(S.scene, cam); // 가림 원통(깊이만)
    occs.forEach((m) => {
      m.visible = false;
    });
    Object.keys(CLIPS).forEach((f) => {
      objs.forEach((l, i) =>
        l.forEach((g, k) => {
          g.visible = was[i][k] && SLOTS[i].st.FINGER === f;
        }),
      );
      renderer.clippingPlanes = [CLIPS[f]];
      renderer.render(S.scene, cam);
    });
    renderer.clippingPlanes = [];
    renderer.autoClear = true;
    objs.forEach((l, i) =>
      l.forEach((g, k) => {
        g.visible = was[i][k];
      }),
    );
    occs.forEach((m, i) => {
      m.visible = occWas[i];
    });
  }

  const { composite, shadow } = createCompose(els);

  function show(i = cur) {
    cur = Math.max(PMIN, Math.min(PMAX, Math.round(i)));
    img.src = frames[cur];
    const t0 = performance.now();
    place();
    renderMain();
    composite(MASKS);
    shadow();
    dbg.lap(t0);
    drawDebug();
    wantMask();
    report();
    if (ST.pickf) emitHints();
  }

  let usedW: number | null = null,
    outerPx: number | null = null;
  // 프레임별 피부 마스크·폭 측정 (three/skinCache.ts). 하나 끝날 때마다 화면 갱신
  const mc = createSkinCache(
    () => ({ frames, LMS, PMIN, PMAX }),
    jlen,
    (url, justFixed) => {
      if (justFixed) {
        show(cur);
        els.onMeasured?.();
      } else {
        report();
        if (dbg.state.on && frames[cur] === url) drawDebug();
      }
    },
  );
  const { masks, meas, ensureMask, warm } = mc;
  function wantMask() {
    if (dbg.state.on) ensureMask(cur);
  }

  // 디버그 그림·리포트·그리기 시간 (three/debug.ts). 값은 부를 때마다 지금 것을 읽음
  const dbg = createDebug(
    els,
    () => ({ frames, LMS, cur, PMIN, PMAX, masks, meas, fixed: mc.fixed, usedW, outerPx }),
    poseOf,
  );
  const { report, drawDebug } = dbg;

  function pickRing(i) {
    if (i === S.CI && S.ring) return;
    S.CI = i;
    const c = CAT[i];
    S.WMM = c.defaultWidth;
    S.WALL = c.wall;
    S.METAL = c.metal;
    S.PAVE = "none";
    if (c.gem) S.GEM = c.gem;
    else if (c.id === "SOL" && NUDO_GEMS.includes(S.GEM)) S.GEM = "dia";
    rebuild();
    show();
  }

  // 재생 프레임이 바뀔 때마다 파베 알 반짝임과 큰 알의 미세한 흔들림을 갱신 (조명 움직임·따로 다시 그리기는 없음)
  // 손 영상 자동 재생: 앞뒤로 계속 왕복 (초당 10장). 손으로 끌면 멈췄다가 1.5초 뒤 다시 돎
  let slideT = 0, // 무빙원 알 위치 계산용 시간(초)
    lastTw = 0,
    raf = 0;
  function twinkle(now) {
    raf = requestAnimationFrame(twinkle);
    if (
      AUTO &&
      !ST.pickf &&
      !document.hidden &&
      dragX === null &&
      now > resumeAt &&
      now - lastPlay > 100
    ) {
      lastPlay = now;
      let n = cur + playDir;
      if (n < PMIN || n > PMAX) {
        playDir = -playDir;
        n = Math.max(PMIN, Math.min(PMAX, cur + playDir));
      }
      show(n);
    }
    if (document.hidden || now - lastTw < TWINKLE_MS || !MASKS.length) return;
    lastTw = now;
    const t = now / 1000;
    twinkleObjs(SLOTS.map((sl) => sl.objs).filter(Boolean), t);
    slideT = t;
  }

  setHand(hand);
  const thumbs = makeThumbs({ CAT, ST, rebuild, dispose, frameFor, setRing, paveCfgOf });
  rebuild();
  show();
  raf = requestAnimationFrame(twinkle);
  return {
    thumbs,
    // 상세 설정: 현재 고른 옵션 읽기 / 바꾸기 (바꾸면 반지를 다시 만들어 그림)
    state() {
      const {
          CI,
          WMM,
          WALL,
          METAL,
          PAVE,
          GW,
          GPAVE,
          GMETAL,
          RMETAL,
          CUT,
          CT,
          GEM,
          PRONG,
          GAPMM,
        } = S,
        stacked = SLOTS.findIndex((sl) => sl.st.FINGER === S.FINGER) < ST.ai;
      return {
        CI,
        WMM,
        WALL,
        METAL,
        PAVE,
        GW,
        GPAVE,
        GMETAL,
        RMETAL,
        CUT,
        CT,
        GEM,
        PRONG,
        GAPMM,
        stacked,
      };
    }, // stacked: 같은 손가락에서 먼저 낀 반지가 있음(간격 고르기 가능)
    set(patch: Record<string, any>) {
      Object.assign(S, patch);
      rebuild();
      show();
    },
    setHand(h: HandData) {
      setHand(h);
      show(PMAX);
    },
    dragStart(x: number, y: number) {
      dragX = x;
      dragY = y;
      drag0 = cur;
    },
    dragMove(x: number, y: number, w: number) {
      if (dragX === null) return;
      const dx = x - dragX,
        dy = dragY - y;
      show(
        drag0 +
          ((Math.abs(dy) > Math.abs(dx) ? dy : dx) / (w || 300)) * N * 1.2,
      );
    },
    dragEnd() {
      dragX = null;
      resumeAt = performance.now() + 1500;
    },
    pick(id: string) {
      const i = CAT.findIndex((c) => c.id === id);
      if (i >= 0) pickRing(i);
    },
    // 위쪽 버튼: 재생/멈춤, 가까이, 내 호수(안쪽 둘레 40+호수 mm 로 손가락 굵기를 다시 잡음)
    setDebug(level: number) {
      dbg.state.on = level > 0;
      dbg.state.text = level === 1;
      if (dbg.state.on) {
        warm();
        wantMask();
      }
      report();
      drawDebug();
    },
    setPlaying(on: boolean) {
      AUTO = on;
      resumeAt = 0;
    },
    setHo(ho: number) {
      S.HO = ho;
      S.FD = (40 + ho) / Math.PI;
      const keepAI = ST.ai;
      SLOTS.forEach((_, i) => {
        activate(i);
        rebuild();
      });
      activate(keepAI);
      show();
    }, // 끼운 반지 모두 새 호수로 다시 만듦
    // 반지 세트 저장/복원. 스냅샷 = 호수 + 끼운 반지들(순서·옵션 전부). 복원 = 지금 반지를 다 치우고 저장본 그대로 다시 끼움 (없는 반지 id 는 건너뜀, 하나도 없으면 false)
    snapshot() {
      return {
        ringSize: S.HO,
        rings: SLOTS.filter((sl) => sl.st).map((sl, order) => {
          const q = sl.st;
          return {
            finger: q.FINGER,
            ringId: CAT[q.CI].id,
            color: q.METAL ?? null,
            width: q.WMM,
            pave: q.PAVE,
            guard: q.GW,
            order,
            opt: { GAPMM: q.GAPMM, WALL: q.WALL, GPAVE: q.GPAVE, GMETAL: q.GMETAL, RMETAL: q.RMETAL, CUT: q.CUT, CT: q.CT, GEM: q.GEM, PRONG: q.PRONG },
          };
        }),
      };
    },
    restore(ho: number, list: any[]) {
      const rs = [...list]
        .sort((a, b) => a.order - b.order)
        .map((r) => ({ r, ci: CAT.findIndex((c) => c.id === r.ringId) }))
        .filter((x) => x.ci >= 0);
      if (!rs.length) return false;
      SLOTS.forEach(({ objs: o }) => {
        if (!o) return;
        dispose(o.ring);
        dispose(o.ring2);
        if (o.head) S.scene.remove(o.head);
      });
      SLOTS.length = 0;
      S.ring = S.ring2 = S.head = null;
      ST.pickf = false;
      S.HO = ho;
      S.FD = (40 + ho) / Math.PI;
      rs.forEach(({ r, ci }) => {
        Object.assign(S, { CI: ci, WALL: CAT[ci].wall, ...(r.opt || {}), FINGER: r.finger, METAL: r.color, WMM: r.width, PAVE: r.pave, GW: r.guard });
        S.ring = S.ring2 = S.head = null;
        ST.ai = SLOTS.length;
        SLOTS.push({ objs: null, st: null });
        rebuild();
      });
      activate(SLOTS.length - 1);
      notifySlots();
      els.onHo?.(ho);
      show();
      return true;
    },
    // 끼운 반지(슬롯)
    slots: slotList,
    switchSlot,
    addSlot,
    removeSlot,
    setPick,
    stop() {
      cancelAnimationFrame(raf);
      SLOTS.forEach(({ objs: o }) => {
        if (!o) return;
        dispose(o.ring);
        dispose(o.ring2);
        if (o.head) S.scene.remove(o.head);
      });
      SLOTS.length = 0;
      S.ring = S.ring2 = S.head = null;
    },
  };
}
