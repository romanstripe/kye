import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RingInfo } from "./three/stage.ts";
import { describe } from "./sets.ts";
import type { SavedSet } from "./sets.ts";

// 제목: 반지 이름들을 쉼표로. 2줄까지 넘기고(말줄임 없음), 그래도 넘치면 2줄째 끝에 회색 "+N"(남은 종류 수)
function SetTitle({ parts }: { parts: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(parts.length);
  const key = parts.join("|");
  useEffect(() => setVis(parts.length), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && vis > 1) setVis(vis - 1); // 넘치면 한 종류씩 줄여서 "+N"까지 두 줄에 들어오게
  });
  const shown = parts.slice(0, vis);
  return (
    <div ref={ref} className="stitle">
      {shown.map((p, i) => (
        <span key={i}>
          {p.replace(/ /g, " ")}
          {i < shown.length - 1 ? ", " : ""}
        </span>
      ))}
      {vis < parts.length && (
        <span className="smore"> +{parts.length - vis}</span>
      )}
    </div>
  );
}

// "내 세트" 탭: 저장한 세트 목록. 줄 전체를 누르면 다시 껴 보기, 편집 중에는 빨간 − 로 지움
export default function SetsList({
  sets,
  rings,
  thumbs,
  edit,
  onPick,
  onRemove,
}: {
  sets: SavedSet[];
  rings: RingInfo[];
  thumbs: Record<string, string>;
  edit: boolean;
  onPick: (s: SavedSet) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="sets">
      {sets.length === 0 && (
        <p className="sempty">
          아직 담은 세트가 없어요.
          <br />
          반지 세트의 하트를 눌러 담아 보세요.
        </p>
      )}
      {sets.map((s) => {
        const d = describe(s, rings);
        return (
          <div className="srow" key={s.id}>
            {edit && (
              <button
                type="button"
                className="sminus"
                aria-label="이 세트 지우기"
                onClick={() => onRemove(s.id)}
              >
                <span />
              </button>
            )}
            <button
              type="button"
              className="sbtn"
              disabled={edit}
              onClick={() => onPick(s)}
            >
              <span className="sthumbs" aria-hidden="true">
                {d.kinds.slice(0, 4).map((k) => (
                  <img key={k.id} alt="" src={thumbs[k.id] ?? ""} />
                ))}
              </span>
              <span className="stxt">
                <SetTitle parts={d.titleParts} />
                <span className="sdesc">{d.desc}</span>
              </span>
              {!edit && (
                <span className="schev" aria-hidden="true">
                  ›
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
