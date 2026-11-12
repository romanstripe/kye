// @ts-nocheck  (원본 데모 를 모양·수치 그대로 옮김)
// ---- 오리지널 솔리테어: 컷 × 캐럿 × 알 종류. 크기는 실제 mm (1캐럿 다이아 기준 치수 × 캐럿^(1/3) × 밀도 보정)
import * as THREE from 'three'
import { S, M, METALS, clip, pmg } from './shared.ts'

export const CUTS={round:{n:'라운드',W:6.5,L:6.5},oval:{n:'오벌',W:5.7,L:7.7},princess:{n:'프린세스',W:5.5,L:5.5},cushion:{n:'쿠션',W:5.6,L:6.0},
 emerald:{n:'에메랄드컷',W:5.0,L:7.0},pear:{n:'페어',W:5.5,L:8.5},marquise:{n:'마퀴즈',W:5.0,L:10.0}};
export const GEMS={dia:{n:'다이아',d:3.52,c:0xffffff,e:3.2},lab:{n:'랩다이아',d:3.52,c:0xffffff,e:3.2},sap:{n:'사파이어',d:4.0,c:0x1d3c9e,e:2.2},
 ruby:{n:'루비',d:4.0,c:0xa3122d,e:2.2},emer:{n:'에메랄드',d:2.72,c:0x0f7a45,e:2.0},gar:{n:'가넷',d:4.0,c:0x5c0b14,e:2.0},opal:{n:'오팔',d:2.1,c:0xffffff,e:1.2}};
// 누디 전용 알 (원본 main13.js 에서 GEMS 에 덧붙이던 것)
export const NUDO_GEMS=['topaz','amet','pras','citr','rose','sap','gar'];
Object.assign(GEMS,{topaz:{n:'블루토파즈',d:3.53,c:0x5fb6e6,e:2.4},amet:{n:'자수정',d:2.65,c:0x8a4fb5,e:2.4},pras:{n:'프라시올라이트',d:2.65,c:0xa9cf8a,e:2.4},
  citr:{n:'시트린',d:2.65,c:0xe8a33a,e:2.4},rose:{n:'로즈쿼츠',d:2.65,c:0xf0b4c2,e:2.2}});
// 보석 전용 반사 환경: 검은 바탕에 작은 흰 조명판을 흩뿌려서 면마다 반짝/어둠이 갈리게
export const gemEnv=(()=>{const es=new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,color:0x050505})));
  let sd=7; const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
  for(let i=0;i<70;i++){const u=rnd()*2-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-u*u),p=new THREE.Mesh(new THREE.PlaneGeometry(4+rnd()*7,4+rnd()*7),new THREE.MeshBasicMaterial({color:rnd()<0.85?0xffffff:[0xffd0a0,0xa0d0ff,0xffa0e0][i%3],side:THREE.DoubleSide}));
    p.position.set(r*Math.cos(a)*40,u*40,r*Math.sin(a)*40); p.lookAt(0,0,0); es.add(p);}
  return pmg.fromScene(es,0).texture;})();
function polyRay(poly,th){const dx=Math.cos(th),dz=Math.sin(th);let best=1e9;
  for(let i=0;i<poly.length;i++){const [ax,az]=poly[i],[bx,bz]=poly[(i+1)%poly.length],ex=bx-ax,ez=bz-az,den=dx*ez-dz*ex; if(Math.abs(den)<1e-9)continue;
    const tt=(ax*ez-az*ex)/den, u=(ax*dz-az*dx)/den; if(tt>0&&u>=0&&u<=1)best=Math.min(best,tt);} return [dx*best,dz*best];}
const SQ=[[1,1],[-1,1],[-1,-1],[1,-1]], OCT=[[1,0.72],[0.72,1],[-0.72,1],[-1,0.72],[-1,-0.72],[-0.72,-1],[0.72,-1],[1,-0.72]];
function outline(cut,t){const c=Math.cos(t),s=Math.sin(t);   // 단위 크기 거들 윤곽 [x(폭), z(길이)]
  if(cut==='round'||cut==='oval')return [c,s];
  if(cut==='cushion'){const p=3;return [Math.sign(c)*Math.pow(Math.abs(c),2/p),Math.sign(s)*Math.pow(Math.abs(s),2/p)];}
  if(cut==='princess')return polyRay(SQ,t);
  if(cut==='emerald')return polyRay(OCT,t);
  if(cut==='pear'){const z=Math.cos(t), x=Math.sin(t)*Math.abs(Math.sin(t/2))/0.77; return [x,z];}
  if(cut==='marquise')return [Math.sin(t)*Math.abs(Math.sin(t)),Math.cos(t)];}
export function gemGeo(cut,W,L,cab){   // mm 단위, 거들이 y=0, 테이블 +y
  const K=cut==='princess'||cut==='emerald'?32:24, P=[];
  const ring=(f,y,rot)=>{const a=[];for(let i=0;i<K;i++){const t=(i+rot)/K*Math.PI*2,[x,z]=outline(cut,t);a.push([x*W/2*f,y,z*L/2*f]);}return a;};
  const tri=(a,b,c)=>P.push(...a,...b,...c);
  const strip=(A,B)=>{for(let i=0;i<K;i++){const j=(i+1)%K;tri(A[i],B[i],A[j]);tri(A[j],B[i],B[j]);}};
  const fan=(A,c,up)=>{for(let i=0;i<K;i++){const j=(i+1)%K; up?tri(A[i],c,A[j]):tri(A[i],A[j],c);}};
  const m=Math.min(W,L);
  if(cab){  // 오팔: 매끈한 돔(카보숑)
    let prev=ring(1,0,0); const rings=[prev];
    for(let k=1;k<=10;k++){const a=k/10*Math.PI/2; const r=ring(Math.cos(a),Math.sin(a)*m*0.38,0); strip(prev,r); prev=r;}
    fan(prev,[0,m*0.38,0],true); fan(ring(1,0,0),[0,-0.3,0],false);
  } else {
    const step=cut==='emerald';
    const g0=ring(1,0,0), g1=ring(1,0.04*m,0);
    const cr=step?ring(0.86,0.09*m,0):ring(0.78,0.1*m,0.5), tb=ring(step?0.7:0.55,0.16*m,0);
    const pv=step?ring(0.62,-0.22*m,0):ring(0.5,-0.25*m,0.5), pv2=step?ring(0.3,-0.38*m,0):null;
    strip(g1,g0); strip(cr,g1); strip(tb,cr); fan(tb,[0,0.16*m,0],true);
    strip(g0,pv); if(pv2){strip(pv,pv2);fan(pv2,[0,-0.43*m,0],false);} else fan(pv,[0,-0.43*m,0],false);
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.computeVertexNormals();
  if(!cab){ // 면마다 밝기를 다르게: 다이아 안쪽 반사(화이트·블랙 패턴)를 흉내
    let sd=11; const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647}; const col=[];
    for(let f=0;f<P.length/9;f++){const v=0.45+0.65*rnd(); const tint=rnd()<0.12?[[1,0.85,0.7],[0.75,0.88,1],[1,0.8,0.95]][f%3]:[1,1,1]; for(let k=0;k<3;k++)col.push(...tint.map(c=>Math.min(1,c*v)));}
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));}
  if(cab){ // 오팔 색 놀이: 우윳빛 바탕에 초록·파랑·주황 얼룩
    const pos=g.attributes.position, col=[], pal=[[0.55,0.95,0.75],[0.45,0.7,1.0],[1.0,0.62,0.35],[0.95,0.6,0.9]];
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const v=Math.sin(x*2.1+z*1.3)+Math.sin(z*2.7-y*3.1)+Math.sin(x*3.3-z*0.7+y);const k=Math.floor((v+3)/6*4*1.999)%4, a=0.25+Math.max(0,Math.sin(v*2.2))*0.6;
      const base=[0.9,0.92,0.95]; col.push(...base.map((b,n)=>b*(1-a)+pal[k][n]*a));}
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));}
  return g;}
export function stoneSize(){const C=CUTS[S.CUT],G=GEMS[S.GEM],f=Math.cbrt(S.CT)*Math.cbrt(3.52/G.d);return {W:C.W*f,L:C.L*f};}
export const SIX={round:[0,1/3,2/3,1,4/3,5/3],oval:[0.5,0.82,1.18,1.5,1.82,0.18],cushion:[0,1/3,2/3,1,4/3,5/3]};  // 6발: 둥근 컷만
export function makeHead(wall,metal){
  const {CUT,CT,GEM,PRONG,FD}=S;
  const {W,L}=stoneSize(), m=Math.min(W,L), cab=GEM==='opal', G=GEMS[GEM], hg=new THREE.Group();
  const Rout=FD/2+wall, pav=cab?0.3:0.43*m, yG=Rout+pav+0.7;   // 거들 높이 = 밴드 바깥면 + 파빌리온 + 받침
  const gmat=cab?new THREE.MeshStandardMaterial({vertexColors:true,metalness:0,roughness:0.12,envMapIntensity:G.e,clippingPlanes:[clip]})
                :new THREE.MeshStandardMaterial({color:G.c,vertexColors:true,metalness:G.c===0xffffff?0.45:0.75,roughness:0.0,flatShading:true,envMap:gemEnv,envMapIntensity:G.c===0xffffff?3.0:2.4,clippingPlanes:[clip]});
  const gem=new THREE.Mesh(gemGeo(CUT,W,L,cab),gmat); gem.position.y=yG; hg.add(gem);
  const pm=M(METALS[metal||'WG'],1,0.12), pr=Math.max(0.33,Math.min(0.6,0.42*Math.cbrt(CT)))*(PRONG===6&&SIX[CUT]?0.85:1);
  const PT={round:[0.25,0.75,1.25,1.75],oval:[0.25,0.75,1.25,1.75],princess:[0.25,0.75,1.25,1.75],cushion:[0.25,0.75,1.25,1.75],emerald:[0.25,0.75,1.25,1.75],pear:[0,0.72,1.28],marquise:[0,0.5,1,1.5]}[CUT].slice(); if(PRONG===6&&SIX[CUT]) PT.splice(0,PT.length,...SIX[CUT]);
  PT.forEach(a=>{const [x,z]=outline(CUT,a*Math.PI); const top=new THREE.Vector3(x*W/2*1.02,yG+(cab?m*0.12:0.05*m),z*L/2*1.02), bot=new THREE.Vector3(x*W/2*0.3,Rout-0.2,z*L/2*0.3);
    const d=top.clone().sub(bot), c=new THREE.Mesh(new THREE.CylinderGeometry(pr,pr*0.85,d.length(),12),pm);
    c.position.copy(top).add(bot).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); hg.add(c);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(pr*1.12,12,8),pm); tip.position.set(x*W/2*0.96,top.y+pr*0.4,z*L/2*0.96); hg.add(tip);});
  const pts=[];for(let i=0;i<24;i++){const [x,z]=outline(CUT,i/24*Math.PI*2);pts.push(new THREE.Vector3(x*W/2*0.62,yG-pav*0.55,z*L/2*0.62));}
  hg.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),64,pr*0.7,8,true),pm));
  hg.userData={W,L,top:yG+0.16*m,gem}; S.scene.add(hg); return hg;}
