// @ts-nocheck  (reference/main13.js 의 무빙원 알·누디 알(nudoGeo, makeNudo)을 모양·수치 그대로 옮김)
import * as THREE from 'three'
import { S, M, METALS, clip } from './shared.ts'
import { GEMS, gemEnv, gemGeo } from './sol.ts'
import { mvDims } from './makeRing.ts'

export function makeSlider(wall,metal){const mv=mvDims(), hg=new THREE.Group(), D=mv.D, Rout=S.FD/2+wall, pm=M(METALS[metal]||METALS.WG,1,0.12);
  const gmat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:0.45,roughness:0,flatShading:true,envMap:gemEnv,envMapIntensity:3.0,clippingPlanes:[clip]});
  const gem=new THREE.Mesh(gemGeo('round',D,D,false),gmat); gem.position.y=Rout+0.55; hg.add(gem);
  const bz=new THREE.Mesh(new THREE.TorusGeometry(D/2+0.12,0.16,10,40),pm); bz.rotation.x=Math.PI/2; bz.position.y=Rout+0.5; hg.add(bz);
  const cup=new THREE.Mesh(new THREE.CylinderGeometry(D/2+0.3,D/2-0.2,0.9,32,1,true),pm); cup.position.y=Rout+0.1; hg.add(cup);
  hg.userData={W:D+1,L:D+1,top:Rout+1.1,gem,slide:true,amp:(mv.a-mv.r-D/2-0.3)/(S.FD/2+mv.r)}; S.scene.add(hg); return hg;}
function nudoGeo(D){ // 누디 컷: 동글한 돔인데 겉은 작은 네모 면으로 깎음, 윤곽은 둥근 네모
  const K=16, NR=5, H=D*0.42, P=[], C=[], sq=a=>{const c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));return 1/Math.pow(Math.pow(c,4)+Math.pow(s,4),0.25);};
  const pt=(i,r)=>{if(r===NR)return [0,H,0]; const a=(i+(r%2)*0.5)/K*Math.PI*2+Math.PI/4, t=Math.cos(r/NR*Math.PI/2), q=sq(a)*D/2*t; return [Math.cos(a)*q,H*Math.sin(r/NR*Math.PI/2)*(r?1:0),Math.sin(a)*q];};
  const tri=(a,b,c)=>{P.push(...a,...b,...c); const h=0.8+0.4*((P.length*7919)%97)/97; for(let n=0;n<3;n++)C.push(h,h,h);};
  for(let r=0;r<NR;r++)for(let i=0;i<K;i++){const j=(i+1)%K;
    if(r===NR-1){tri(pt(i,r),pt(0,NR),pt(j,r));continue;}
    if(r%2===0){tri(pt(i,r),pt(i,r+1),pt(j,r)); tri(pt(j,r),pt(i,r+1),pt(j,r+1));}
    else {tri(pt(i,r),pt(j,r+1),pt(j,r)); tri(pt(i,r),pt(i,r+1),pt(j,r+1));}}
  for(let i=0;i<K;i++){const j=(i+1)%K; tri(pt(i,0),pt(j,0),[0,-D*0.3,0]);}  // 아래 뾰족한 파빌리온
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(C,3)); g.computeVertexNormals(); return g;}
export function makeNudo(wall,metal,W){const hg=new THREE.Group(), D=W<3.5?7.5:10, Rout=S.FD/2+wall, pm=M(METALS[metal]||METALS.PG,1,0.14), G=GEMS[S.GEM]||GEMS.topaz;
  const bh=2.4, s=D*0.98/Math.SQRT2;   // 네모 상자 받침: 알 둘레와 같은 네모, 안쪽 세팅을 다 가림
  // 네모 받침은 빼기로 (사용자 요청 11/10)
  const gmat=new THREE.MeshStandardMaterial({color:G.c,vertexColors:true,metalness:0.5,roughness:0.04,flatShading:true,envMap:gemEnv,envMapIntensity:G.e,transparent:true,opacity:0.94,clippingPlanes:[clip]});
  const gem=new THREE.Mesh(nudoGeo(D),gmat); gem.position.y=Rout+0.9+D*0.2; hg.add(gem);
  hg.userData={W:D,L:D,top:Rout+0.9+D*0.62,gem}; S.scene.add(hg); return hg;}
