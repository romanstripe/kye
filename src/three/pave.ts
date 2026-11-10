// 반지별 파베 알 배치 설정. 수식(W=>...)이라 JSON에 못 담아서 id별로 여기 둠. 원본: reference/main13.js CAT
export type PaveFn = (W: number) => any
export const PAVE_CFG: Record<string, Record<string, PaveFn>> = {
 B: {
  semi: (_W: number)=>({ys:[0],arc:0.5,d:1.0,flat:1}),
  full: (_W: number)=>({ys:[0],arc:1,d:1.0,flat:1}),
 },
 Q: {
  semi: (W: number)=>{const nb=W<=4.5?2:4;return {ys:[(nb-0.5)/nb-0.5],arc:0.5,d:W/nb*0.62,flat:1}},
  full: (W: number)=>{const nb=W<=4.5?2:4;return {ys:[(nb-0.5)/nb-0.5],arc:1,d:W/nb*0.62,flat:1}},
 },
 L: {
  semi: (W: number)=>({ys:[0],count:6,arc:1,d:W*0.34,flat:1}),
  full: (W: number)=>({arc:1,d:Math.min(1.15,W/3),flat:1}),
 },
 CL: {
  semi: (W: number)=>({ys:[0],grid:W*0.95,skip:2,arc:1,d:W*0.45,flat:1,lift:0.08}),
  full: (W: number)=>({ys:[-0.44,0.44],arc:1,d:W*0.13,flat:1}),
 },
 SP: {
  semi: (_W: number)=>({scales:1,alt:1,d:0.75,noBeads:1}),
  full: (_W: number)=>({scales:1,d:0.75,noBeads:1}),
 },
 I: {
  semi: (W: number)=>({ys:[-0.25,0.25],grid:W/2,arc:0.5,d:W/2*0.6,flat:1}),
  full: (W: number)=>({ys:[-0.25,0.25],grid:W/2,arc:1,d:W/2*0.6,flat:1}),
 },
 BB: {
  semi: (W: number)=>({ys:[-0.125],arc:0.5,d:W/4*0.7}),
  full: (W: number)=>({ys:[-0.375,0.125],arc:1,d:W/4*0.7}),
 },
 H: {
  semi: (W: number)=>({hex:1,alt:1,d:W<3.5?0.72:0.64,noBeads:1}),
  full: (W: number)=>({hex:1,d:W<3.5?0.72:0.64,noBeads:1}),
 },
 PE: {
  semi: (W: number)=>({ys:[0],grid:W,skip:3,arc:1,d:W*0.62,flat:1}),
  full: (W: number)=>({ys:[0],grid:W,arc:1,d:W*0.62,flat:1}),
 },
 CC: {
  semi: (W: number)=>({quilt:1,one:1,d:W*0.44,noBeads:1}),
  full: (W: number)=>({quilt:1,d:Math.min(1.0,W*0.22),noBeads:1}),
 },
 SOL: {
  semi: (W: number)=>({ys:[0],arc:0.5,d:W*0.75}),
  full: (W: number)=>({ys:[0],arc:1,d:W*0.75}),
 },
 S: {
  semi: (W: number)=>({ys:[0],arc:0.5,d:Math.min(W*0.7,2.2)}),
  full: (W: number)=>({ys:[0],arc:1,d:Math.min(W*0.7,2.2)}),
 },
 MV: {
  semi: (_W: number)=>({mv:1,front:1,d:0.75,noBeads:1}),
  full: (_W: number)=>({mv:1,d:0.75,noBeads:1}),
 },
 ND: {
  full: (W: number)=>({ys:[0],arc:1,d:W*0.55}),
 },
}
