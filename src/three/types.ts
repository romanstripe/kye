// public/rings.json 의 반지 한 개. pave.*.byWidth[폭] = layoutStones 에 넘기는 설정
export type PaveOpt = { label: string; byWidth: Record<string, any> };
export type RingInfo = {
  id: string;
  name: string;
  sub: string;
  widths: number[];
  widthLabels?: Record<string, string>;
  defaultWidth: number;
  wall: number;
  metal: string | null;
  diy: boolean;
  rimColor: boolean;
  gemPick: boolean;
  gem: string | null;
  pave: Partial<Record<"semi" | "alt" | "full" | "both", PaveOpt>>;
};
// frames: 프레임 이미지 주소, P/LMS: 프레임별 손 좌표, pmin~pmax: 왕복 재생할 구간
export type HandData = {
  N: number;
  P: (number[] | null)[];
  LMS: number[][][];
  frames: string[];
  pmin: number;
  pmax: number;
};
export type StageEls = {
  img: HTMLImageElement;
  shadow: HTMLCanvasElement;
  out: HTMLCanvasElement;
  debug?: HTMLCanvasElement;
  onInfo?: (s: string) => void;
  onMeasured?: () => void;
  onHo?: (ho: number) => void;
  onSlots?: (list: { id: string; active: boolean; finger: string }[]) => void;
  onHints?: (list: { f: string; name: string; x: number; y: number }[]) => void;
};
