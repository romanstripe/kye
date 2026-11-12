// @ts-nocheck  (원본 데모 의 밴드·무늬·파베 알·makeRing 을 모양·수치 그대로 옮김)
import * as THREE from 'three'
import { S, M, H, METALS, TAU, wrap, clip } from './shared.ts'
import { gemEnv } from './sol.ts'

export const TW = new THREE.Color(), HK = 7
// 밴드 한 겹: 단면은 둥근 볼록(pe가 작을수록 납작), pattern(th,v)으로 표면 무늬
function band(y0,h,tR,pattern,mat,rows=24,pe=0.55){
  const seg=pattern.seg||256, Ri=1.0; const pos=[],idx=[];
  for(let j=0;j<=rows;j++){const v=j/rows, y=y0+v*h; const edge=Math.sin(Math.PI*v);
    for(let i=0;i<=seg;i++){const th=i/seg*Math.PI*2;
      const d=Ri+tR*(0.3+0.7*Math.pow(edge,pe))+pattern(th,v)*Math.pow(edge,0.8);
      pos.push(Math.cos(th)*d,y,Math.sin(th)*d);}}
  for(let j=0;j<rows;j++)for(let i=0;i<seg;i++){const a=j*(seg+1)+i,b=a+seg+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g,mat);}
// 파베 알: 보석 전용 반사로 반짝이게
const stoneMat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:0.5,roughness:0,flatShading:true,envMap:gemEnv,envMapIntensity:3.4,clippingPlanes:[clip]});
// 파베 알 한 개: 브릴리언트처럼 테이블·크라운·파빌리온이 있는 깎인 모양
const stoneGeo=(()=>{const g0=new THREE.LatheGeometry([new THREE.Vector2(0.001,-0.75),new THREE.Vector2(1,0),new THREE.Vector2(1,0.06),new THREE.Vector2(0.84,0.2),new THREE.Vector2(0.48,0.34),new THREE.Vector2(0.001,0.34)],12).toNonIndexed();
  // 면마다 밝고 어두움을 번갈아 칠해 다이아의 화살 무늬처럼 빛이 갈라지게 (흰 원판처럼 보이지 않게)
  const pos=g0.attributes.position, col=[]; for(let t=0;t<pos.count;t+=3){const y=(pos.getY(t)+pos.getY(t+1)+pos.getY(t+2))/3, a=Math.atan2(pos.getZ(t)+pos.getZ(t+1)+pos.getZ(t+2),pos.getX(t)+pos.getX(t+1)+pos.getX(t+2)), k=Math.floor((a+Math.PI)/(Math.PI/6))%2;
    const c=y>0.3?0.62:y>0.1?(k?1.0:0.3):y>0?(k?0.45:0.85):(k?0.22:0.55); for(let n=0;n<3;n++)col.push(c,c,c);}
  g0.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g0.computeVertexNormals(); return g0;})();
const beadGeo=new THREE.SphereGeometry(1,8,6);   // 알을 잡는 작은 금속 발
const caps=(g,t,k,mat)=>{[-H/2,H/2].forEach(y=>{const r=new THREE.RingGeometry(1.0,1+t*k,128);r.rotateX(Math.PI/2);const c=new THREE.Mesh(r,mat);c.position.y=y;g.add(c);});
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1,1,H,128,1,true),mat));};
// 세르펜토 비늘: 경계선이 번갈아 기울어 비늘 하나는 위가 넓고 다음 것은 아래가 넓은 사다리꼴
function spScale(W,R){const p=W*0.78, n=2*Math.round(TAU*R/p/2); return {n,p:TAU*R/n,sl:0.42};}
export function spB(sc,k,v){return k+(k%2?-1:1)*sc.sl*(v-0.5);}
export function spAt(sc,th,v){const u=wrap(th)/TAU*sc.n; let k=Math.floor(u); if(u<spB(sc,k,v))k--; else if(u>=spB(sc,k+1,v))k++;
  const a=spB(sc,k,v), b=spB(sc,k+1,v); return {k:((k%sc.n)+sc.n)%sc.n, dmm:Math.min(u-a,b-u)*sc.p, cu:(u-(a+b)/2)/((b-a)/2), a, b};}
// 무빙원 치수(mm): 기본 타원 10.3×4.6, 파베형 12×4.5 (메시카 상품 정보 기준). a,b = 타원 선 중심의 반지름
export function mvDims(){const pv=S.PAVE!=='none', big=S.WMM>5;
  if(big){const r=pv?0.65:0.6; return {a:13.9/2-r,b:5.8/2-r,r,rb:0.8,D:2.6};}   // 라지: 13.9×5.8, 0.06ct ≈ 2.6mm (파베 라지는 치수 미공개 → 같은 크기로)
  const r=pv?0.5:0.45, L=pv?12:10.3, Wd=pv?4.5:4.6; return {a:L/2-r,b:Wd/2-r,r,rb:0.6,D:pv?2.2:1.4};}   // 스몰: 10.3×4.6, 0.01ct ≈ 1.4mm / 파베 스몰 12×4.5
// ---- 반지 만들기. 모두 비슷하지만 똑같지 않은 자체 디자인
export function makeRing(style,wall,metal,W){
  const t=wall/(S.FD/2), R=S.FD/2, g=new THREE.Group(); let tR=t, pe=0.55;
  const mat=M(METALS[metal]||METALS.YG,1,0.16); mat.envMapIntensity=1.6;
  const one=(pat,rows=24,p=0.55,k=0.33)=>{tR=t*(style==='S'||style==='SOL'?1.1:1);pe=p;g.add(band(-H/2,H,tR,pat,mat,rows,p));caps(g,t,k,mat);};
  if(style==='S'||style==='SOL'){ one(()=>0); }
  else if(style==='MG'){           // 밀그레인: 민짜 밴드 + 위아래 끝에 아주 작은 구슬 테두리(색 따로)
    const rh=H*Math.min(0.55/W,0.2), tt=t*1.1, rm=M(METALS[S.RMETAL==='same'?metal:S.RMETAL]||METALS.WG,1,0.18); rm.envMapIntensity=1.6;
    g.add(band(-H/2+rh,H-2*rh,tt,()=>0,mat,24,0.5));
    const n=Math.round(TAU*R*1.1/0.5), bp=(th,v)=>{const u=th/TAU*n, fu=u-Math.floor(u)-0.5; return 0.03*(Math.sqrt(Math.max(0,1-4*fu*fu))-0.7);}; bp.seg=n*8;
    g.add(band(-H/2,rh,tt*0.92,bp,rm,8,0.6)); g.add(band(H/2-rh,rh,tt*0.92,bp,rm,8,0.6));
    tR=tt; pe=0.5; caps(g,t,0.33,rm); }
  else if(style==='Q'){            // 콰트레: 질감 다른 띠 2줄(4mm) 또는 4줄(7mm)
    const parts=[[0xf0c36e,1,0.16,(th,v)=>0.05*Math.pow(Math.abs(Math.sin(th*36+v*5.5)),0.6)],[0x3b2a22,0.6,0.32,()=>0],
     [0xf0b49c,1,0.22,th=>0.03*(Math.sin(th*160)>0?1:0)],[0xeef0f3,1,0.12,(th,v)=>0.035*Math.abs(Math.sin(th*40+v*3))*Math.abs(Math.sin(th*40-v*3))]];
    const nb=W<=4.5?2:4, use=parts.slice(0,nb); g.userData.nb=nb;
    use.forEach((p,k)=>g.add(band(-H/2+k*H/nb+0.012,H/nb-0.024,t,p[3],M(p[0],p[1],p[2]))));
    const grooveM=M(0x6b5536,1,0.5);
    for(let k=1;k<nb;k++){const gg=new THREE.Mesh(new THREE.CylinderGeometry(1+t*0.55,1+t*0.55,0.03,128,1,true),grooveM);gg.position.y=-H/2+k*H/nb;g.add(gg);}
    caps(g,t,0.32,M(0xd9b46a,1,0.3));
  } else if(style==='B'){          // 비제로투: 나선 테두리 두 줄 + 매끈한 가운데
    // 미니(폭 < 6mm) = 가운데 통통한 띠 1줄, 라지 = 2줄. 테두리 폭은 mm로 같게
    const nb=W<6?1:2, E=H*Math.min(0.24,1.15/W); tR=t*1.05; g.userData.bz={nb,E:E/H};
    g.add(band(-H/2,E,t*1.5,(th,v)=>0.11*Math.pow(Math.abs(Math.sin(th*55+v*Math.PI*1.2)),0.35),mat));
    g.add(band(H/2-E,E,t*1.5,(th,v)=>0.11*Math.pow(Math.abs(Math.sin(th*55-v*Math.PI*1.2)),0.35),mat));
    const ch=(H-2*E)/nb; for(let k=0;k<nb;k++) g.add(band(-H/2+E+k*ch+(nb>1?0.006:0),ch-(nb>1?0.012:0),tR,()=>0,mat));
    caps(g,t,0.32,mat);
  } else if(style==='L'){          // 러브볼트: 납작한 밴드 + 나사 6개(대각 홈)
    const rs=0.3*W, ns=6;
    one((th,v)=>{const c=Math.round(wrap(th)/TAU*ns-0.0)%ns, dth=wrap(th-c/ns*TAU+Math.PI)-Math.PI, x=dth*R, y=(v-0.5)*W, d=Math.hypot(x,y);
      let z=0; if(Math.abs(d-rs)<0.08*W) z-=0.025; if(d<rs*0.72&&Math.abs((x+y)*0.7071)<0.05*W) z-=0.025; return z;},56,0.15,0.3);
  } else if(style==='I'){          // 아이스블록: 작은 큐브 두 줄 격자
    const n=Math.round(TAU*R/(W/2));
    one((th,v)=>{const a=Math.abs(Math.sin(th/TAU*n*Math.PI)), b=Math.abs(Math.sin(v*2*Math.PI)); return 0.05*Math.pow(Math.min(a,b),0.25)-0.025;},64,0.2,0.3);
  } else if(style==='H'){          // 베이비마이: 벌집처럼 볼록한 육각 셀
    const rowsN=W<3.5?1:2, p=W/rowsN, n=Math.round(TAU*R/p), k=TAU/p;
    one((th,v)=>{const x=th/TAU*n*p, y=(v-0.5)*W*(rowsN===1?1.6:1.15);
      const f=Math.cos(k*x)+Math.cos(k*(x/2+y*0.866))+Math.cos(k*(x/2-y*0.866)); return 0.03*Math.min(1,Math.max(0,(f+0.2)/1.4))-0.012;},64,0.35,0.3);
  } else if(style==='SP'){         // 세르펜토: 방향이 번갈아 뒤집힌 사다리꼴 비늘이 맞물림
    const sc=spScale(W,R); g.userData.sp=sc;
    const f=(th,v)=>{const q=spAt(sc,th,v), ed=Math.min(v,1-v)*W;
      const e=Math.min(q.dmm,ed*2.5), bev=Math.min(1,e/0.5);
      return 0.07*Math.sqrt(bev)-0.012*q.cu*q.cu-0.05;}; f.seg=720;
    one(f,128,0.3,0.3);
  } else if(style==='PE'){         // 뻬를라: 동글동글 구슬이 이어진 밴드
    const n=Math.round(TAU*R/W);
    one((th,v)=>{const u=th/TAU*n, fu=u-Math.floor(u)-0.5; return 0.07*(Math.sqrt(Math.max(0,1-4*fu*fu))-1);},32,0.9,0.25);
  } else if(style==='CC'){         // 코코퀼트: 사선 퀼팅
    const p=W/2, n=2*Math.round(TAU*R/p/2); g.userData.cc={n};
    one((th,v)=>{const s=th/TAU*n, y=v*2; const a=Math.abs(Math.sin(Math.PI*(s+y)/2)), b=Math.abs(Math.sin(Math.PI*(s-y)/2)); return 0.03*Math.pow(Math.min(a,b),0.3)-0.015;},64,0.25,0.3);
  } else if(style==='BB'){         // 베르베로: 링 네 줄이 붙은 듯한 한 덩어리
    one((th,v)=>0.05*(Math.pow(Math.abs(Math.sin(Math.PI*v*4)),0.45)-1),64,0.3,0.25);
  } else if(style==='CL'){         // 클래싱: 가운데 줄에 뾰족 스터드와 둥근 구슬이 번갈아
    const p=W*0.95, n=2*Math.round(TAU*R/p/2);
    one((th,v)=>{const u=th/TAU*n, i=Math.floor(u), fu=u-i-0.5, fv=v-0.5; if(Math.abs(fv)>0.42) return 0;
      return i%2? 0.13*Math.max(0,1-2.6*Math.max(Math.abs(fu),Math.abs(fv)))-0.02 : 0.11*Math.sqrt(Math.max(0,1-6*(fu*fu+fv*fv)))-0.02;},72,0.25,0.3);
  } else if(style==='SPR'){        // 스피랄레: 가는 선 세 가닥이 손가락을 감아 도는 소용돌이
    one((th,v)=>0.07*Math.pow(Math.abs(Math.sin(th*HK+v*Math.PI*1.5)),0.5)-0.045,72,0.35,0.28);
  } else if(style==='MV'){         // 무빙원: 손등 쪽에 완전히 닫힌 타원 틀(가로 10.3 × 세로 4.6mm, 파베형 12 × 4.5) + 뒤는 가는 한 줄. 알이 타원 안에서 움직임
    const mv=mvDims(), rmm=mv.r, Rr=R+rmm; tR=2*rmm/R; pe=1; g.userData.mv=mv;
    const toL=new THREE.Matrix4().makeScale(1/R,H/W,1/R);
    const ell=new THREE.Curve(); ell.getPoint=(t,o=new THREE.Vector3())=>{const f=t*TAU, sa=mv.a*Math.cos(f), th=Math.PI/2+sa/Rr; return o.set(Math.cos(th)*Rr,mv.b*Math.sin(f),Math.sin(th)*Rr);};
    const back=new THREE.Curve(); const t0=Math.PI/2+mv.a/Rr, t1=Math.PI/2-mv.a/Rr+TAU; back.getPoint=(t,o=new THREE.Vector3())=>{const th=t0+(t1-t0)*t; return o.set(Math.cos(th)*Rr,0,Math.sin(th)*Rr);};
    [[ell,160,true,rmm],[back,200,false,mv.rb]].forEach(([c,n,cl,r])=>{const geo=new THREE.TubeGeometry(c,n,r,12,cl); geo.applyMatrix4(toL); g.add(new THREE.Mesh(geo,mat));});
  } else if(style==='ND'){         // 누디: 통통한 밴드 위에 큰 컬러 알
    one(()=>0,24,0.8,0.33);
  } else if(style==='IC'){         // 아이콘볼: 볼록한 돔 밴드 + 여러 색 알
    one(()=>0,32,0.9,0.3);
  }
  const s=new THREE.InstancedMesh(stoneGeo,stoneMat,900); s.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(2700).fill(1),3); s.count=0; s.visible=false;
  const bd=new THREE.InstancedMesh(beadGeo,mat,1800); bd.count=0; s.add(bd); s.userData.beads=bd;
  g.userData={...g.userData,t,tR,pe,style,W,mat,stones:s};
  S.scene.add(g); S.scene.add(s); return g;}
