const IW=480, IH=854, N=F.length;
const img=document.getElementById('img'), r=document.getElementById('r'), st=document.getElementById('stage'), cv=document.createElement('canvas'), outc=document.getElementById('out'), ox=outc.getContext('2d');
r.max=N-1; F.forEach(s=>{const i=new Image();i.src=s});
const $=id=>document.getElementById(id);

// ---- three
const renderer=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1)); renderer.setSize(IW,IH,false);
renderer.localClippingEnabled=true; renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;
const mainScene=new THREE.Scene(); let scene=mainScene;
const cam=new THREE.OrthographicCamera(0,IW,0,-IH,-1000,1000); cam.position.z=400;
const pmg=new THREE.PMREMGenerator(renderer);
function makeEnv(bg,lights){const es=new THREE.Scene();
 es.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,color:bg})));
 lights.forEach(([c,x,y,z,s])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(s,s),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,0,0);es.add(p)});
 return pmg.fromScene(es,0.02).texture;}
const LIGHTS={
 store:{env:makeEnv(0x2e2e31,[[0xcfcfcf,0,42,0,16],[0xffffff,20,38,10,7],[0xffffff,-20,38,10,7],[0xffffff,0,15,45,18],[0xffffff,38,10,18,8],[0xffffff,-38,10,18,8],[0xffffff,-20,25,-35,16],[0xeef2ff,25,-10,35,10],[0x8c8a88,0,-45,0,60]]),
   exp:1.35, key:[0xffffff,1.6], img:'brightness(1.05) contrast(1.03)', tint:'rgba(255,255,255,0.05)', blend:'screen'},
 sun:{env:makeEnv(0x24190f,[[0xffd49a,45,15,10,40],[0xffe2b8,0,40,0,30],[0xbfd2ff,-40,30,0,20],[0x6b5a46,0,-45,0,60]]),
   exp:1.2, key:[0xffd6a0,1.4], img:'saturate(1.05) brightness(1.03)', tint:'rgba(255,190,120,0.10)', blend:'soft-light'},
 office:{env:makeEnv(0x101211,[[0xffffff,0,45,0,18],[0xf2f7f5,30,40,0,10],[0xf2f7f5,-30,40,0,10],[0xe8efed,0,12,45,10],[0xffffff,-40,5,-20,8],[0x2e3432,0,-45,0,60]]),
   exp:1.3, key:[0xf2f6f5,1.1], img:'none', tint:'transparent', blend:'normal'}};
mainScene.add(new THREE.AmbientLight(0xffffff,0.15));
const key=new THREE.DirectionalLight(0xffffff,1.1); key.position.set(-0.4,1,0.8); mainScene.add(key);
const rim=new THREE.DirectionalLight(0xffffff,0.7); rim.position.set(0.6,-0.3,-0.2); mainScene.add(rim);   // 뒤쪽 테두리 빛: 반지 가장자리가 밝게 떠서 두께가 보임
let LIGHT='office';
function applyLight(){const L=LIGHTS[LIGHT]; mainScene.environment=L.env; renderer.toneMappingExposure=L.exp; key.color.setHex(L.key[0]); key.intensity=L.key[1];
 img.style.filter=L.img; const tn=$('tint'); tn.style.background=L.tint; tn.style.mixBlendMode=L.blend;}

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
const clip=new THREE.Plane();
const M=(c,met,rough)=>new THREE.MeshStandardMaterial({color:c,metalness:met,roughness:rough,clippingPlanes:[clip],side:THREE.DoubleSide});
const H=0.62;
let HO=17.5, FD=(40+HO)/Math.PI;   // 호수 → 안쪽 둘레(40+호수 mm) → 지름
const METALS={PG:0xf2b9a2,YG:0xf0c36e,WG:0xeef0f3};
/*SOL*/
// 파베 알: 보석 전용 반사로 반짝이게
const stoneMat=new THREE.MeshStandardMaterial({color:0xffffff,metalness:0.45,roughness:0,flatShading:true,envMap:gemEnv,envMapIntensity:3.0,clippingPlanes:[clip]});
// 파베 알 한 개: 브릴리언트처럼 테이블·크라운·파빌리온이 있는 깎인 모양
const stoneGeo=new THREE.LatheGeometry([new THREE.Vector2(0.001,-0.7),new THREE.Vector2(1,0),new THREE.Vector2(1,0.05),new THREE.Vector2(0.58,0.3),new THREE.Vector2(0.001,0.3)],8);
const beadGeo=new THREE.SphereGeometry(1,8,6);   // 알을 잡는 작은 금속 발
const TAU=Math.PI*2, TW=new THREE.Color(), HK=7;
const caps=(g,t,k,mat)=>{[-H/2,H/2].forEach(y=>{const r=new THREE.RingGeometry(1.0,1+t*k,128);r.rotateX(Math.PI/2);const c=new THREE.Mesh(r,mat);c.position.y=y;g.add(c);});
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(1,1,H,128,1,true),mat));};
const wrap=a=>((a%TAU)+TAU)%TAU;
// 세르펜토 비늘: 경계선이 번갈아 기울어 비늘 하나는 위가 넓고 다음 것은 아래가 넓은 사다리꼴
function spScale(W,R){const p=W*0.78, n=2*Math.round(TAU*R/p/2); return {n,p:TAU*R/n,sl:0.42};}
function spB(sc,k,v){return k+(k%2?-1:1)*sc.sl*(v-0.5);}
function spAt(sc,th,v){const u=wrap(th)/TAU*sc.n; let k=Math.floor(u); if(u<spB(sc,k,v))k--; else if(u>=spB(sc,k+1,v))k++;
  const a=spB(sc,k,v), b=spB(sc,k+1,v); return {k:((k%sc.n)+sc.n)%sc.n, dmm:Math.min(u-a,b-u)*sc.p, cu:(u-(a+b)/2)/((b-a)/2), a, b};}
// 무빙원 치수(mm): 기본 타원 10.3×4.6, 파베형 12×4.5 (메시카 상품 정보 기준). a,b = 타원 선 중심의 반지름
function mvDims(){const pv=PAVE!=='none', big=WMM>5;
  if(big){const r=pv?0.65:0.6; return {a:13.9/2-r,b:5.8/2-r,r,rb:0.8,D:2.6};}   // 라지: 13.9×5.8, 0.06ct ≈ 2.6mm (파베 라지는 치수 미공개 → 같은 크기로)
  const r=pv?0.5:0.45, L=pv?12:10.3, Wd=pv?4.5:4.6; return {a:L/2-r,b:Wd/2-r,r,rb:0.6,D:pv?2.2:1.4};}   // 스몰: 10.3×4.6, 0.01ct ≈ 1.4mm / 파베 스몰 12×4.5
function mvOff(th){const d=Math.abs(wrap(th-Math.PI/2+Math.PI)-Math.PI), d0=0.35, d1=1.25; return d<d0?1:d>d1?0:Math.cos(Math.PI/2*(d-d0)/(d1-d0))**2;}

// ---- 반지 만들기. 모두 비슷하지만 똑같지 않은 자체 디자인
function makeRing(style,wall,metal,W){
  const t=wall/(FD/2), R=FD/2, g=new THREE.Group(); let tR=t, pe=0.55;
  const mat=M(METALS[metal]||METALS.YG,1,0.16); mat.envMapIntensity=1.6;
  const one=(pat,rows=24,p=0.55,k=0.33)=>{tR=t*(style==='S'||style==='SOL'?1.1:1);pe=p;g.add(band(-H/2,H,tR,pat,mat,rows,p));caps(g,t,k,mat);};
  if(style==='S'||style==='SOL'){ one(()=>0); }
  else if(style==='Q'){            // 콰트레: 질감 다른 띠 2줄(4mm) 또는 4줄(7mm)
    const parts=[[0xf0c36e,1,0.16,(th,v)=>0.05*Math.pow(Math.abs(Math.sin(th*36+v*5.5)),0.6)],[0x3b2a22,0.6,0.32,()=>0],
     [0xf0b49c,1,0.22,th=>0.03*(Math.sin(th*160)>0?1:0)],[0xeef0f3,1,0.12,(th,v)=>0.035*Math.abs(Math.sin(th*40+v*3))*Math.abs(Math.sin(th*40-v*3))]];
    const nb=W<=4.5?2:4, use=parts.slice(0,nb); g.userData.nb=nb;
    use.forEach((p,k)=>g.add(band(-H/2+k*H/nb+0.012,H/nb-0.024,t,p[3],M(p[0],p[1],p[2]))));
    const grooveM=M(0x6b5536,1,0.5);
    for(let k=1;k<nb;k++){const gg=new THREE.Mesh(new THREE.CylinderGeometry(1+t*0.55,1+t*0.55,0.03,128,1,true),grooveM);gg.position.y=-H/2+k*H/nb;g.add(gg);}
    caps(g,t,0.32,M(0xd9b46a,1,0.3));
  } else if(style==='B'){          // 비제로투: 나선 테두리 두 줄 + 매끈한 가운데
    const E=0.24*H; tR=t*1.05;
    g.add(band(-H/2,E,t*1.5,(th,v)=>0.11*Math.pow(Math.abs(Math.sin(th*55+v*Math.PI*1.2)),0.35),mat));
    g.add(band(H/2-E,E,t*1.5,(th,v)=>0.11*Math.pow(Math.abs(Math.sin(th*55-v*Math.PI*1.2)),0.35),mat));
    g.add(band(-H/2+E,H-2*E,tR,()=>0,mat)); caps(g,t,0.32,mat);
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
  scene.add(g); scene.add(s); return g;}

// 파베 알 배치. cfg: ys(폭 방향 위치 -0.5~0.5) / d(알 지름 mm) / arc(1=한 바퀴, 0.5=손등 쪽 절반) / count(고정 개수) / grid(무늬 칸 피치 mm, 칸 가운데에 알) / skip(n칸마다 하나)
function layoutStones(g,cfg,yk){
  const {tR,pe,W}=g.userData, R=FD/2, st=g.userData.stones, m=new THREE.Matrix4(), q=new THREE.Quaternion(), up=new THREE.Vector3(0,1,0);
  const d=cfg.d, rowsN=cfg.ys?cfg.ys.length:Math.max(1,Math.floor(W*0.9/(d*1.12)));
  const ys=cfg.ys||Array.from({length:rowsN},(_,i)=>rowsN===1?0:(i/(rowsN-1)-0.5)*(W*0.9-d)/W);
  const sz=(d/2)/R, bead=st.userData.beads; let c=0, b=0;
  const base=st.userData.base||(st.userData.base=new Float32Array(2700));
  const put=(th,f,rr,ri,hp)=>{if(c>=900)return; const dir=new THREE.Vector3(Math.cos(th),0,Math.sin(th)); q.setFromUnitVectors(up,dir);
      m.compose(dir.clone().multiplyScalar(rr).setY(f*H*yk),q,new THREE.Vector3(sz,sz,sz)); st.setMatrixAt(c,m);
      const col=cfg.colors?new THREE.Color(cfg.colors[c%cfg.colors.length]):new THREE.Color(1,1,1); base[c*3]=col.r;base[c*3+1]=col.g;base[c*3+2]=col.b;
      const h=0.45+0.75*(Math.abs(Math.sin(c*12.9898+ri*78.233)*43758.5453)%1); st.setColorAt(c++,col.multiplyScalar(cfg.colors?Math.min(1,h+0.3):h));
      const bsz=sz*0.2; [-1,1].forEach(sg=>{if(b>=1800||cfg.noBeads)return; const a=th+hp, dv=new THREE.Vector3(Math.cos(a),0,Math.sin(a)); m.compose(dv.multiplyScalar(rr+sz*0.12).setY(f*H*yk+sg*sz*0.55),q,new THREE.Vector3(bsz,bsz,bsz)); bead.setMatrixAt(b++,m);});};
  if(cfg.quilt){ // 코코퀼트: 퀼팅 선(금)은 남기고 마름모 칸 안에만 알
    const n=g.userData.cc.n, u=W/2, lift=(v)=>1+tR*(0.3+0.7*Math.pow(Math.sin(Math.PI*v),pe))+0.012-sz*0.1;
    const cells=[]; for(let k=0;k<n;k+=2){cells.push([k,1]); if(!cfg.one){cells.push([k+1,0],[k+1,2]);}}
    cells.forEach(([sc,yc],ci)=>{
      if(cfg.one){const v=yc/2; put(sc/n*TAU,v-0.5,lift(v)+0.01,ci,0.02); return;}
      const st=d*0.98/u, m=0.16/u+st*0.4;
      for(let dy=-1;dy<=1;dy+=st)for(let ds=-1;ds<=1;ds+=st){const y=yc+dy, s=sc+ds+((Math.round((dy+1)/st))%2?st/2:0);
        if(y<0.12||y>1.88)continue; if(Math.abs(s-sc)+Math.abs(y-yc)>1-m)continue; const v=y/2; put(wrap(s/n*TAU),v-0.5,lift(v),ci,0.02);}});
    ys.length=0;}
  if(cfg.mv){ const mv=g.userData.mv, Rr=R+mv.r, rr=(Rr+mv.r)/R-sz*0.2, per=Math.PI*(3*(mv.a+mv.b)-Math.sqrt((3*mv.a+mv.b)*(mv.a+3*mv.b))), n=Math.floor(per/(d*1.05));
    for(let k=0;k<n;k++){const f=k/n*TAU; put(Math.PI/2+mv.a*Math.cos(f)/Rr, mv.b*Math.sin(f)/W, rr, k, 0.02);}
    if(!cfg.front){const t0=Math.PI/2+mv.a/Rr+d/Rr, t1=Math.PI/2-mv.a/Rr+TAU-d/Rr, m=Math.floor((t1-t0)*Rr/(d*1.05)); for(let k=0;k<=m;k++) put(t0+(t1-t0)*k/m,0,(Rr+mv.rb)/R-sz*0.2,k,0.02);}
    ys.length=0;}
  if(cfg.scales){ const sc=g.userData.sp;
    for(let k=0;k<sc.n;k++){ if(cfg.alt&&k%2)continue;
      [0.22,0.4,0.6,0.78].forEach((v,ri)=>{const a=spB(sc,k,v), b=spB(sc,k+1,v), w=(b-a)*sc.p-0.5, m=Math.max(1,Math.floor(w/(d*1.05)));
        for(let i=0;i<m;i++){const u=a+(b-a)*(0.5+(i-(m-1)/2)*(d*1.05)/((b-a)*sc.p)); put(u/sc.n*TAU,v-0.5,1+tR*(0.3+0.7*Math.pow(Math.sin(Math.PI*v),pe))+0.03-sz*0.1,ri,0.02);}});}
    ys.length=0;}
  if(cfg.hex){ // 베이비마이: 육각 셀 가운데에만 한 알씩 (무늬 식과 같은 격자)
    const rowsN=W<3.5?1:2, p=W/rowsN, n=Math.round(TAU*R/p), sy=W*(rowsN===1?1.6:1.15);
    for(let k=0;k<n;k++){ if(cfg.alt&&k%2)continue;
      for(let j=-3;j<=3;j++){const y=(j+(k%2?0.5:0))*p/0.866, v=y/sy+0.5; if(v<0.08||v>0.92)continue;
        // 칸 하나를 가운데 1알 + 둘레 6알로 꽉 채움 (금 벽은 남김)
        const rc=p*0.31; [[0,0],...[0,1,2,3,4,5].map(a=>[Math.cos(a*Math.PI/3+Math.PI/6)*rc,Math.sin(a*Math.PI/3+Math.PI/6)*rc])].forEach(([ox,oy])=>{
          const vv=v+oy/sy; if(vv<0.06||vv>0.94)return; put(k/n*TAU+ox/R,vv-0.5,1+tR*(0.3+0.7*Math.pow(Math.sin(Math.PI*vv),pe))+0.03-sz*0.1,k,0.02);});}}
    ys.length=0;}
  if(cfg.helix){ // 소용돌이 선을 따라 알 배치: 선은 sin(θ·HK + v·1.5π)=1 인 곳
    const dthv=1.5*Math.PI/HK, L=Math.hypot(R*dthv,W*0.8), nv=Math.max(2,Math.floor(L/(d*1.05))), hp=0.06;
    for(let j=0;j<2*HK;j++){ if(cfg.strands===1&&(j&1))continue;
      for(let k=0;k<=nv;k++){const v=0.1+0.8*k/nv, th=wrap((Math.PI/2+j*Math.PI-v*1.5*Math.PI)/HK+TAU*9);
        if(cfg.arc<1){const dd=Math.abs(wrap(th-Math.PI/2+Math.PI)-Math.PI); if(dd>cfg.arc*Math.PI)continue;}
        put(th,v-0.5,1+tR*(0.3+0.7*Math.pow(Math.sin(Math.PI*v),pe))+0.045-sz*0.1,j,hp);}}
    ys.length=0;}
  ys.forEach((f,ri)=>{const v=f+0.5, edge=cfg.flat?1:Math.sin(Math.PI*v), rr=1+tR*(0.3+0.7*Math.pow(edge,pe))+(cfg.lift||0)-sz*0.1;
    let ths=[];
    if(cfg.grid){const n=Math.round(TAU*R/cfg.grid); for(let k=0;k<n;k+=(cfg.skip||1)) ths.push((k+0.5+(cfg.gridOff||0))/n*TAU);}
    else if(cfg.count){for(let k=0;k<cfg.count;k++) ths.push((k+0.5)/cfg.count*TAU);}
    else {const n=Math.floor(TAU*R*rr/(d*1.08)); for(let k=0;k<n;k++) ths.push((k+(ri%2)*0.5)/n*TAU);}
    const hp=ths.length>1?(ths[1]-ths[0])/2:0.1, bsz=sz*0.2;
    ths.forEach(th=>{ if(cfg.arc<1){const dd=Math.abs(wrap(th-Math.PI/2+Math.PI)-Math.PI); if(dd>cfg.arc*Math.PI) return;}
      put(th,f,rr,ri,hp);});});
  bead.count=b; bead.instanceMatrix.needsUpdate=true;
  if(st.instanceColor)st.instanceColor.needsUpdate=true;
  st.count=c; st.instanceMatrix.needsUpdate=true;}
function dispose(g){if(!g)return; scene.remove(g); scene.remove(g.userData.stones);}

// ---- 카탈로그. 이름은 실제 제품과 다르게 바꾼 자체 이름, 폭은 대략값
const SEMI='세미 파베', FULL='풀 파베';
const CAT=[
 {id:'B',cat:'국민',name:'비제로투',sub:'나선 테두리',ws:[4.8],wall:1.8,metal:'PG',
  pave:{semi:[SEMI,W=>({ys:[0],arc:0.5,d:1.0,flat:1})],full:[FULL,W=>({ys:[0],arc:1,d:1.0,flat:1})]}},
 {id:'Q',cat:'대세',name:'콰트레',sub:'네 가지 질감',ws:[4,7],wl:{4:'4mm · 두 줄',7:'7mm · 네 줄'},dw:1,wall:1.8,metal:null,
  pave:{semi:[SEMI,W=>{const nb=W<=4.5?2:4;return {ys:[(nb-0.5)/nb-0.5],arc:0.5,d:W/nb*0.62,flat:1}}],full:['파베 한 줄',W=>{const nb=W<=4.5?2:4;return {ys:[(nb-0.5)/nb-0.5],arc:1,d:W/nb*0.62,flat:1}}]}},
 {id:'L',cat:'국민',name:'러브볼트',sub:'나사 여섯 개',ws:[3.6,5.5],dw:1,wall:1.9,metal:'YG',
  pave:{semi:['알 6개',W=>({ys:[0],count:6,arc:1,d:W*0.34,flat:1})],full:[FULL,W=>({arc:1,d:Math.min(1.15,W/3),flat:1})]}},
 {id:'CL',cat:'대세',name:'클래싱',sub:'스터드와 구슬',ws:[5],wall:1.7,metal:'PG',
  pave:{semi:['구슬에만',W=>({ys:[0],grid:W*0.95,skip:2,arc:1,d:W*0.45,flat:1,lift:0.08})],full:[FULL,W=>({ys:[-0.44,0.44],arc:1,d:W*0.13,flat:1})]}},
 {id:'SP',cat:'대세',name:'세르펜토',sub:'맞물린 사다리꼴 비늘',ws:[4],wall:1.7,metal:'YG',
  pave:{semi:['비늘 하나 걸러',W=>({scales:1,alt:1,d:0.75,noBeads:1})],full:['모든 비늘',W=>({scales:1,d:0.75,noBeads:1})]}},
 {id:'I',cat:'패피',name:'아이스블록',sub:'작은 큐브 격자',ws:[3.5],wall:1.6,metal:'WG',
  pave:{semi:[SEMI,W=>({ys:[-0.25,0.25],grid:W/2,arc:0.5,d:W/2*0.6,flat:1})],full:[FULL,W=>({ys:[-0.25,0.25],grid:W/2,arc:1,d:W/2*0.6,flat:1})]}},
 {id:'BB',cat:'패피',name:'베르베로',sub:'네 줄이 하나로',ws:[5],wall:1.6,metal:'YG',
  pave:{semi:['한 줄만',W=>({ys:[-0.125],arc:0.5,d:W/4*0.7})],full:['두 줄',W=>({ys:[-0.375,0.125],arc:1,d:W/4*0.7})]}},
 {id:'H',cat:'국민',name:'베이비마이',sub:'벌집 셀',ws:[2.5,4.5],dw:1,wall:1.4,metal:'PG',
  pave:{semi:['칸 하나 걸러',W=>({hex:1,alt:1,d:W<3.5?0.72:0.64,noBeads:1})],full:['모든 칸',W=>({hex:1,d:W<3.5?0.72:0.64,noBeads:1})]}},
 {id:'PE',cat:'국민',name:'뻬를라',sub:'동글동글 구슬',ws:[2.5,3.5],wall:1.5,metal:'YG',
  pave:{semi:['구슬 사이사이',W=>({ys:[0],grid:W,skip:3,arc:1,d:W*0.62,flat:1})],full:['모든 구슬',W=>({ys:[0],grid:W,arc:1,d:W*0.62,flat:1})]}},
 {id:'CC',cat:'국민',name:'코코퀼트',sub:'퀼팅 마름모',ws:[3,5.5],wl:{3:'미니',5.5:'스몰'},dw:1,wall:1.6,metal:'YG',
  pave:{semi:['마름모마다 한 알',W=>({quilt:1,one:1,d:W*0.44,noBeads:1})],full:['마름모 가득',W=>({quilt:1,d:Math.min(1.0,W*0.22),noBeads:1})]}},
 {id:'SOL',cat:'오리지널',name:'나만의 솔리테어',sub:'컷·캐럿·알 직접',ws:[1.6,2,2.5],dw:1,wall:1.6,metal:'WG',diy:true,
  pave:{semi:[SEMI,W=>({ys:[0],arc:0.5,d:W*0.75})],full:[FULL,W=>({ys:[0],arc:1,d:W*0.75})]}},
 {id:'S',cat:'오리지널',name:'민짜반지',sub:'장식 없는 한 줄',ws:[2,3,4,5,6],dw:1,wall:1.8,metal:'YG',diy:true,
  pave:{semi:['하프 이터니티',W=>({ys:[0],arc:0.5,d:Math.min(W*0.7,2.2)})],full:['풀 이터니티',W=>({ys:[0],arc:1,d:Math.min(W*0.7,2.2)})]}},
 {id:'MV',cat:'대세',name:'무빙원',sub:'타원 틀 안에서 움직이는 알',ws:[4.6,5.8],wl:{4.6:'스몰 (타원 10.3mm)',5.8:'라지 (타원 13.9mm)'},wall:1.0,metal:'WG',
  pave:{semi:['타원에만',W=>({mv:1,front:1,d:0.75,noBeads:1})],full:['타원 + 밴드',W=>({mv:1,d:0.75,noBeads:1})]}},
 {id:'ND',cat:'패피',name:'누디',sub:'네모 상자 위 동글게 깎은 컬러 알',ws:[3,4],wl:{3:'쁘띠',4:'클래식'},dw:1,wall:2.0,metal:'PG',gemPick:true,gem:'topaz',
  pave:{full:['밴드 파베',W=>({ys:[0],arc:1,d:W*0.55})]}},
];
const TABS=['전체','대세','패피','국민','오리지널'];

// 상태
let GMETAL='same', CI=0, WMM=4.8, WALL=1.8, METAL='PG', PAVE='none', GW=0, GPAVE=false, MASK=null, pxmmNow=1, ring=null, ring2=null;
function ringWall(){const c=CAT[CI]; return c.diy?WALL:c.wall;}
function rebuild(){dispose(ring);dispose(ring2);if(head){scene.remove(head);head=null;}
  const c=CAT[CI]; ring=makeRing(c.id,ringWall(),METAL,WMM);
  if(c.id==='SOL') head=makeHead(Math.min(ringWall(),1.6),METAL);
  if(c.id==='MV') head=makeSlider(0.0,METAL);
  if(c.id==='ND') head=makeNudo(ringWall(),METAL,WMM);
  ring2=GW>0?makeRing('S',Math.min(ringWall(),1.5),GMETAL==='same'?(METAL||'YG'):GMETAL,GW):null;}
function paveCfg(){const c=CAT[CI]; return PAVE!=='none'&&c.pave[PAVE]?c.pave[PAVE][1](WMM):null;}
// 반지 놓기: 로컬 y = 손가락 축, 로컬 +z = 손등 쪽
function setRing(g,q,pos,Rin,bandW,axis,off,cfg,sx=1){   // sx: 화면에서 손가락 옆 방향으로만 조임 (반지 모양은 그대로 둥글게)
  g.visible=true; g.quaternion.copy(q); g.scale.set(Rin,bandW/H,Rin); g.position.copy(pos).add(axis.clone().multiplyScalar(off));
  const s=g.userData.stones; s.visible=!!cfg;
  if(cfg){layoutStones(g,cfg,(bandW/H)/Rin); s.scale.setScalar(Rin); s.quaternion.copy(q); s.position.copy(g.position);}
  [g,s].forEach(o=>{o.matrixAutoUpdate=sx===1; o.updateMatrix();});
  if(sx!==1){ // 화면 평면에서 손가락 축에 수직인 방향 L로만 sx배 (카메라 쪽 깊이는 건드리지 않아 옆으로 돌아도 납작해지지 않음)
    const a=new THREE.Vector2(axis.x,axis.y).normalize(), L=new THREE.Vector3(-a.y,a.x,0), c=g.position;
    const S=new THREE.Matrix4().set(1+(sx-1)*L.x*L.x,(sx-1)*L.x*L.y,0,0, (sx-1)*L.y*L.x,1+(sx-1)*L.y*L.y,0,0, 0,0,1,0, 0,0,0,1);
    const W=new THREE.Matrix4().makeTranslation(c.x,c.y,c.z).multiply(S).multiply(new THREE.Matrix4().makeTranslation(-c.x,-c.y,-c.z));
    [g,s].forEach(o=>{o.matrix.premultiply(W);});}}

// 안 보이는 3D 손 견본(깊이만): 손가락 뒤로 가는 반지 부분을 가림
const occMat=new THREE.MeshBasicMaterial({colorWrite:false});
const SEGS=[[13,14,0.92],[14,15,0.88],[15,16,0.8],[9,10,1.0],[10,11,0.95],[11,12,0.85],[17,18,0.85],[18,19,0.8],[19,20,0.72],[5,6,1.0],[6,7,0.95],[7,8,0.85],[0,9,1.6],[0,13,1.6],[0,17,1.5],[0,5,1.6]];
const occ=SEGS.map(()=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,24,1,false),occMat);m.renderOrder=-1;mainScene.add(m);return m});
const JI=[13,14,15,9,10,11,17,18,19,5,6,7];
const occJ=JI.map(()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),occMat);m.renderOrder=-1;mainScene.add(m);return m});
let OX=0,OY=0, DZK=0.3, FRK=0.85, SQZ=0.89, LSH=0.07, FEATHER=0.8, OCCK=0.89; const V=(L,i)=>new THREE.Vector3(L[i][0]+OX,-(L[i][1]+OY),-L[i][2]);   // DZK: 손가락이 카메라 쪽으로 기운 정도(깊이)를 얼마나 믿을지
function placeOcc(L,rad){
  SEGS.forEach(([i,j,k],n)=>{const a=V(L,i),b=V(L,j),m=occ[n],d=b.clone().sub(a),len=d.length();
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); m.scale.set(rad*k,len,rad*k); m.visible=true;});
  JI.forEach((i,n)=>{occJ[n].position.copy(V(L,i)); occJ[n].scale.setScalar(rad*0.9); occJ[n].visible=true;});}
function hideOcc(){occ.forEach(m=>m.visible=false);occJ.forEach(m=>m.visible=false);}
function dorsal(i){const s=new THREE.Vector3();
  for(let k=-2;k<=2;k++){const L=LMS[Math.max(0,Math.min(N-1,i+k))]; if(!L)continue; const a=V(L,5).sub(V(L,0)), b=V(L,17).sub(V(L,0)); s.add(a.cross(b).normalize());}
  const Lr=LMS[N-1], ref=V(Lr,5).sub(V(Lr,0)).cross(V(Lr,17).sub(V(Lr,0))); if(ref.z<0)s.negate(); return s.normalize();}
function frameFor(axis,nrm,bl=0.4){ // 손등 방향(축에 수직) 구하고 회전 만들기
  const Y=nrm.clone().sub(axis.clone().multiplyScalar(nrm.dot(axis)));
  const camv=new THREE.Vector3(0,0,1).sub(axis.clone().multiplyScalar(axis.z));
  Y.normalize().multiplyScalar(1-bl).add(camv.normalize().multiplyScalar(bl)).normalize();
  const qR=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(axis,Y),axis,Y));
  const Z=axis.clone().negate(), qH=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(Y,Z),Y,Z));
  return {qR,qH};}
let cur=0;
function place(p){
  if(!p){[ring,ring2].forEach(g=>{if(g){g.visible=false;g.userData.stones.visible=false}});if(head)head.visible=false;MASK=null;hideOcc();return}
  const [cx,cy,cz,dx,dy,dz,fr]=p;
  const axis=new THREE.Vector3(dx,-dy,-dz*DZK).normalize(), pos=new THREE.Vector3(cx,-cy,-cz);
  const frK=fr*FRK, pxmm=2*frK/FD; pxmmNow=pxmm; const Rin=frK, bandW=WMM*pxmm, W2=GW*pxmm, gap=0.2*pxmm;
  const {qR,qH}=frameFor(axis,dorsal(cur));
  pos.add(new THREE.Vector3(1,0,0).applyQuaternion(qR).multiplyScalar(Rin*LSH));   // LSH: 반지를 손가락 옆 방향으로 살짝 옮김 (이 영상에서 왼쪽으로 치우쳐 보여서)
  setRing(ring,qR,pos,Rin,bandW,axis,0,paveCfg(),SQZ);
  if(ring2) setRing(ring2,qR,pos,Rin,W2,axis,bandW/2+gap+W2/2,GPAVE?{ys:[0],arc:1,d:GW*0.75}:null,SQZ);
  {const L=LMS[cur]; OX=cx-(L[13][0]+L[14][0])/2; OY=cy-(L[13][1]+L[14][1])/2;}
  placeOcc(LMS[cur],frK*OCCK);
  const t=ring.userData.t, u2=Math.hypot(dx,dy)||1;
  MASK={cx,cy,ux:dx/u2,uy:dy/u2,hw:Rin*SQZ*(1+t*1.8)+2+0.6*pxmm,hl:bandW+W2+Rin*1.5};   // 끝을 자르지 않도록 넉넉하게
  if(head){const qq=head.userData.slide?qR.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)):qH; head.quaternion.copy(qq); head.userData.q0=qq.clone(); head.userData.axis=axis.clone(); slideHead(); head.position.copy(pos); head.scale.setScalar(pxmm); head.visible=true;
    MASK.hw+=(head.userData.top+head.userData.W/2-FD/2)*pxmm; MASK.hl=Math.max(MASK.hl,(head.userData.L/2+1.5)*pxmm*1.2);}
  const n=new THREE.Vector3(0,0,1); n.sub(axis.clone().multiplyScalar(n.dot(axis)));
  if(n.length()<0.15){clip.set(new THREE.Vector3(0,0,1),1000);return}
  n.normalize(); clip.setFromNormalAndCoplanarPoint(n,pos.clone().add(n.clone().multiplyScalar(-Rin*0.15)));}

const sh=$('sh'), sx2=sh.getContext('2d');
function composite(){
  outc.width=cv.width; outc.height=cv.height; const k=cv.width/IW;
  ox.clearRect(0,0,outc.width,outc.height); if(!MASK)return;
  ox.drawImage(cv,0,0);
  const {cx,cy,ux,uy,hw,hl}=MASK, px=-uy, py=ux;
  ox.globalCompositeOperation='destination-in'; ox.filter=`blur(${FEATHER*k}px)`; ox.fillStyle='#000'; ox.beginPath();
  [[hl,hw],[hl,-hw],[-hl,-hw],[-hl,hw]].forEach(([a,b],i)=>{const X=(cx+ux*a+px*b)*k, Y=(cy+uy*a+py*b)*k; i?ox.lineTo(X,Y):ox.moveTo(X,Y)});
  ox.closePath(); ox.fill(); ox.filter='none';
  ox.globalCompositeOperation='source-over';}
function shadow(){
  sh.width=cv.width; sh.height=cv.height; const k=cv.width/IW;
  sx2.clearRect(0,0,sh.width,sh.height);
  // 그림자 두 겹: 넓고 옅은 그림자(공중에 뜬 느낌 지움) + 반지가 피부에 닿는 곳의 짙고 좁은 접촉 그림자
  const tmp=shadow.t||(shadow.t=document.createElement('canvas')); tmp.width=sh.width; tmp.height=sh.height; const tx=tmp.getContext('2d');
  [[7,2,4,'rgba(70,40,32,0.32)'],[1.6,0.6,1.4,'rgba(45,25,20,0.75)']].forEach(([bl,dx,dy,col])=>{
    tx.clearRect(0,0,tmp.width,tmp.height); tx.filter=`blur(${bl*k}px)`; tx.drawImage(outc,dx*k,dy*k); tx.filter='none';
    tx.globalCompositeOperation='source-in'; tx.fillStyle=col; tx.fillRect(0,0,tmp.width,tmp.height); tx.globalCompositeOperation='source-over';
    sx2.drawImage(tmp,0,0);});}
let zoom=false; const zw=$('zw'); let zc=[240,400];
function applyZoom(){const Z=2.6,bx=$('box'),k=bx.clientWidth/IW;
 if(!zoom){zw.style.transform='none';return}
 const tx=Math.min(0,Math.max(bx.clientWidth*(1-Z), bx.clientWidth/2-zc[0]*k*Z)), ty=Math.min(0,Math.max(bx.clientHeight*(1-Z), bx.clientHeight/2-zc[1]*k*Z));
 zw.style.transform=`translate(${tx}px,${ty}px) scale(${Z})`;}
function show(i){cur=Math.max(typeof PMIN==='number'?PMIN:0,Math.min(N-1,Math.round(i)));img.src=F[cur];r.value=cur; const gt=document.getElementById('grabtxt'); if(gt)gt.textContent='▲ '+CAT[CI].name+' · 반지 고르기';
  if(P[cur])zc=[P[cur][0],P[cur][1]]; place(P[cur]); renderer.render(scene,cam); composite(); shadow(); applyZoom();}

// ---- 무빙원 알: 손가락 축을 따라 돌며 좌우로 미끄러짐
let slideT=0;
function slideHead(){const u=head&&head.userData; if(!u||!u.slide||!u.q0)return; head.quaternion.copy(u.q0).premultiply(new THREE.Quaternion().setFromAxisAngle(u.axis,u.amp*Math.sin(slideT*0.9)));}
function makeSlider(wall,metal){const mv=mvDims(), hg=new THREE.Group(), D=mv.D, Rout=FD/2+wall, pm=M(METALS[metal]||METALS.WG,1,0.12);
  const gmat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:0.45,roughness:0,flatShading:true,envMap:gemEnv,envMapIntensity:3.0,clippingPlanes:[clip]});
  const gem=new THREE.Mesh(gemGeo('round',D,D,false),gmat); gem.position.y=Rout+0.55; hg.add(gem);
  const bz=new THREE.Mesh(new THREE.TorusGeometry(D/2+0.12,0.16,10,40),pm); bz.rotation.x=Math.PI/2; bz.position.y=Rout+0.5; hg.add(bz);
  const cup=new THREE.Mesh(new THREE.CylinderGeometry(D/2+0.3,D/2-0.2,0.9,32,1,true),pm); cup.position.y=Rout+0.1; hg.add(cup);
  hg.userData={W:D+1,L:D+1,top:Rout+1.1,gem,slide:true,amp:(mv.a-mv.r-D/2-0.3)/(FD/2+mv.r)}; scene.add(hg); return hg;}
const NUDO_GEMS=['topaz','amet','pras','citr','rose','sap','gar'];
Object.assign(GEMS,{topaz:{n:'블루토파즈',d:3.53,c:0x5fb6e6,e:2.4},amet:{n:'자수정',d:2.65,c:0x8a4fb5,e:2.4},pras:{n:'프라시올라이트',d:2.65,c:0xa9cf8a,e:2.4},
  citr:{n:'시트린',d:2.65,c:0xe8a33a,e:2.4},rose:{n:'로즈쿼츠',d:2.65,c:0xf0b4c2,e:2.2}});
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
function makeNudo(wall,metal,W){const hg=new THREE.Group(), D=W<3.5?7.5:10, Rout=FD/2+wall, pm=M(METALS[metal]||METALS.PG,1,0.14), G=GEMS[GEM]||GEMS.topaz;
  const bh=2.4, s=D*0.98/Math.SQRT2;   // 네모 상자 받침: 알 둘레와 같은 네모, 안쪽 세팅을 다 가림
  // 네모 받침은 빼기로 (사용자 요청 11/10)
  const gmat=new THREE.MeshStandardMaterial({color:G.c,vertexColors:true,metalness:0.5,roughness:0.04,flatShading:true,envMap:gemEnv,envMapIntensity:G.e,transparent:true,opacity:0.94,clippingPlanes:[clip]});
  const gem=new THREE.Mesh(nudoGeo(D),gmat); gem.position.y=Rout+0.9+D*0.2; hg.add(gem);
  hg.userData={W:D,L:D,top:Rout+0.9+D*0.62,gem}; scene.add(hg); return hg;}
// ---- 썸네일: 같은 렌더러로 작은 칸에 반지를 하나씩 그려 이미지로
const thumbs={};
function makeThumbs(){
  const tScene=new THREE.Scene(); tScene.environment=LIGHTS.store.env; tScene.add(new THREE.AmbientLight(0xffffff,0.25));
  const tk=new THREE.DirectionalLight(0xffffff,1.3); tk.position.set(-0.4,1,0.8); tScene.add(tk);
  const tCam=new THREE.OrthographicCamera(-1,1,1,-1,-100,100); tCam.position.z=50;
  const S=136, pr=renderer.getPixelRatio(), tc=document.createElement('canvas'); tc.width=tc.height=S; const tx=tc.getContext('2d');
  const keep={CI,WMM,WALL,METAL,PAVE,GW,GEM}; scene=tScene; clip.set(new THREE.Vector3(0,0,1),1000);
  renderer.setScissorTest(true); renderer.setViewport(0,0,S/pr,S/pr); renderer.setScissor(0,0,S/pr,S/pr); renderer.toneMappingExposure=1.3;
  const axis=new THREE.Vector3(0,0.62,0.78).normalize();
  CAT.forEach((c,i)=>{CI=i; WMM=c.ws[c.dw||0]; WALL=c.wall; METAL=c.metal; PAVE=c.id==='IC'?'semi':'none'; GW=0; if(c.gem)GEM=c.gem; rebuild();
    const Rin=0.58, pxmm=Rin/(FD/2), pos=new THREE.Vector3(0,c.id==='SOL'||c.id==='ND'?-0.25:-0.05,0), {qR,qH}=frameFor(axis,new THREE.Vector3(0,0.78,-0.62),0);
    setRing(ring,qR,pos,Rin,WMM*pxmm,axis,0,paveCfg());
    if(head){head.quaternion.copy(qH);head.position.copy(pos);head.scale.setScalar(pxmm);head.visible=true;}
    renderer.setClearColor(0x000000,0); renderer.clear(); renderer.render(tScene,tCam);
    tx.clearRect(0,0,S,S); tx.drawImage(cv,0,cv.height-S,S,S,0,0,S,S); thumbs[c.id]=tc.toDataURL();});
  dispose(ring);dispose(ring2);ring=ring2=null;if(head){tScene.remove(head);head=null;}
  scene=mainScene; renderer.setScissorTest(false); renderer.setViewport(0,0,IW,IH);
  ({CI,WMM,WALL,METAL,PAVE,GW,GEM}=keep);}

// ---- UI
function chips(el,opts,curv,fn){el.innerHTML='';opts.forEach(([v,l,dot])=>{const b=document.createElement('button');b.type='button';
  b.innerHTML=(dot?`<i style="background:${dot}"></i>`:'')+l; b.setAttribute('aria-pressed',String(v===curv));
  b.onclick=()=>{fn(v);renderDetail();rebuild();show(cur)}; el.appendChild(b);});}
const wl=(c,w)=>(c.wl&&c.wl[w])||(w+'mm');
function solInfo(){if(CAT[CI].id!=='SOL'){$('solinfo').textContent='';return}
  const {W,L}=stoneSize(), dim=Math.abs(W-L)<0.05?`지름 약 ${W.toFixed(1)}mm`:`약 ${L.toFixed(1)} × ${W.toFixed(1)}mm`;
  const note=GEM==='lab'?' · 눈으로는 천연과 같아요':GEM==='opal'?' · 가벼워서 같은 캐럿이면 더 커요':GEM==='emer'?' · 가벼워서 조금 더 커요':(GEM==='sap'||GEM==='ruby'||GEM==='gar')?' · 무거워서 조금 작아요':'';
  $('solinfo').textContent=`${CUTS[CUT].n} ${CT}ct ${GEMS[GEM].n} · ${dim}${note}`;}
function renderDetail(){const c=CAT[CI];
  $('dname').textContent=c.name; $('dsub').textContent=c.sub;
  $('g-metal').hidden=!c.metal; chips($('c-metal'),[['PG','로즈골드','#e9b49e'],['YG','옐로골드','#e8c06a'],['WG','화이트골드','#dfe2e6']],METAL,v=>METAL=v);
  $('g-w').hidden=c.ws.length<2; chips($('c-w'),c.ws.map(w=>[w,wl(c,w)]),WMM,v=>WMM=v);
  chips($('c-pave'),[['none','없음'],...['semi','full'].filter(k=>c.pave[k]).map(k=>[k,c.pave[k][0]])],PAVE,v=>PAVE=v);
  $('g-th').hidden=!c.diy; chips($('c-th'),[[1.2,'얇게 1.2mm'],[1.8,'보통 1.8mm'],[2.6,'두껍게 2.6mm']],WALL,v=>WALL=v);
  $('g-sol').hidden=!(c.id==='SOL'||c.gemPick); $('g-cut').hidden=$('g-ct').hidden=c.id!=='SOL';
  if(c.gemPick){chips($('c-gem'),NUDO_GEMS.map(k=>[k,GEMS[k].n]),GEM,v=>GEM=v); $('solinfo').textContent='';}
  if(c.id==='SOL'){chips($('c-cut'),Object.entries(CUTS).map(([k,o])=>[k,o.n]),CUT,v=>CUT=v);
    $('g-pr').hidden=!SIX[CUT]; chips($('c-pr'),[[4,'4발'],[6,'6발']],PRONG,v=>PRONG=v);
    chips($('c-ct'),[0.3,0.5,1,1.5,2,3].map(k=>[k,k+'ct']),CT,v=>CT=v);
    chips($('c-gem'),Object.entries(GEMS).map(([k,o])=>[k,o.n]),GEM,v=>GEM=v); solInfo();}
  chips($('c-gw'),[[0,'없음'],[1,'1.0'],[1.5,'1.5'],[2,'2.0'],[2.5,'2.5'],[3,'3.0mm']],GW,v=>GW=v);
  $('c-gp').hidden=!GW; chips($('c-gp'),[[false,'매끈하게'],[true,'가드링 파베']],GPAVE,v=>GPAVE=v);
  $('c-gm').hidden=!GW; chips($('c-gm'),[['same','반지와 같은 색'],['PG','로즈골드','#e9b49e'],['YG','옐로골드','#e8c06a'],['WG','화이트골드','#dfe2e6']],GMETAL,v=>GMETAL=v);}
function pickRing(i){if(i===CI&&ring){updatePicked();return;} CI=i; const c=CAT[i]; WMM=c.ws[c.dw||0]; WALL=c.wall; METAL=c.metal; PAVE='none'; if(c.gem)GEM=c.gem; else if(c.id==='SOL'&&NUDO_GEMS.includes(GEM))GEM='dia';
  rebuild(); show(cur); updatePicked();}
function updatePicked(){const c=CAT[CI]; $('picked').textContent=`${c.name} · ${c.sub} · ${wl(c,WMM)}`;
  document.querySelectorAll('.card').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.i===CI)));}
let TAB='전체';
function renderTabs(){return; /* 분류 탭은 뺐어요 (11/10): 전체 한 줄 */ const el=$('tabs'); el.innerHTML='';
  TABS.forEach(t=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.textContent=t+(t==='대세'?' 반지':t==='패피'?' 반지':t==='국민'?' 반지':'');
    b.setAttribute('aria-selected',String(t===TAB)); b.onclick=()=>{TAB=t;renderTabs();renderWheel();}; el.appendChild(b);});}
function renderWheel(){const el=$('wheel'); el.innerHTML='';
  CAT.forEach((c,i)=>{if(TAB!=='전체'&&c.cat!==TAB)return; const b=document.createElement('button'); b.type='button'; b.className='card'; b.dataset.i=i;
    b.innerHTML=`<img alt="" src="${thumbs[c.id]}"><span class="n">${c.name}</span>`; b.setAttribute('aria-label',c.name+', '+c.sub);
    b.onclick=()=>{b.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}); pickRing(i);}; el.appendChild(b);});
  el.scrollLeft=0; requestAnimationFrame(()=>{onWheel(true)});}
let wheelT=null;
function onWheel(now){const el=$('wheel'), mid=el.getBoundingClientRect().left+el.clientWidth/2; let best=null,bd=1e9;
  el.querySelectorAll('.card').forEach(b=>{const r=b.getBoundingClientRect(), d=Math.abs(r.left+r.width/2-mid); b.style.transform=`scale(${1+0.22*Math.max(0,1-d/100)})`; if(d<bd){bd=d;best=b;}});
  if(!best)return; clearTimeout(wheelT); const i=+best.dataset.i; if(now)pickRing(i); else wheelT=setTimeout(()=>pickRing(i),90);}
$('wheel').addEventListener('scroll',()=>requestAnimationFrame(()=>onWheel(false)),{passive:true});
$('b-detail').onclick=()=>{renderDetail();$('pList').hidden=true;$('pDetail').hidden=false;requestAnimationFrame(()=>show(cur));};
$('b-back').onclick=$('b-done').onclick=()=>{$('pDetail').hidden=true;$('pList').hidden=false;updatePicked();renderWheelKeep();};
function renderWheelKeep(){requestAnimationFrame(()=>{applyZoom();const b=document.querySelector(`.card[data-i="${CI}"]`); if(b){b.scrollIntoView({inline:'center',block:'nearest'});} onWheel(true);});}
$('s-light').onchange=e=>{LIGHT=e.target.value;applyLight();show(cur)};
const bZ=$('b-zoom'); bZ.onclick=()=>{zoom=!zoom;bZ.setAttribute('aria-pressed',String(zoom));renderer.setPixelRatio(zoom?3:Math.min(2,window.devicePixelRatio||1));renderer.setSize(IW,IH,false);show(cur)};
$('s-ho').onchange=e=>{HO=+e.target.value;FD=(40+HO)/Math.PI;rebuild();show(cur)};   // 내 호수: 안쪽 둘레 40+호수 mm로 손가락 굵기를 다시 잡음
r.addEventListener('input',()=>show(+r.value));
let sx=null,sy=0,s0=0;
st.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;s0=cur;st.setPointerCapture(e.pointerId)});
st.addEventListener('pointermove',e=>{if(sx===null)return;const w=st.clientWidth||300;const dx=e.clientX-sx, dy=sy-e.clientY;show(s0+(Math.abs(dy)>Math.abs(dx)?dy:dx)/w*N*1.2)});
st.addEventListener('pointerup',()=>{sx=null;resumeAt=performance.now()+1500});st.addEventListener('pointercancel',()=>{sx=null;resumeAt=performance.now()+1500});
// 손 영상 자동 재생: 앞뒤로 계속 왕복 (초당 약 10장). 손으로 끌면 잠깐 멈췄다가 1.5초 뒤 다시 돎
let playDir=-1, lastPlay=0, resumeAt=0; const PMIN=27, PMAX=N-1, AUTO=true;   // 손 영상 자동 왕복 재생, 끌면 잠깐 멈춤   // 정면에 가까운 구간만 재생 (옆으로 많이 돈 프레임은 반지가 떠 보여서 뺌)
// 바텀시트 접기/펴기: 손잡이를 누르거나 아래·위로 밀기
const sheet=$('sheet'), bG=$('b-grab'); let gy=null;
function setSheet(open){sheet.classList.toggle('collapsed',!open); bG.setAttribute('aria-expanded',String(open)); bG.setAttribute('aria-label',open?'반지 고르기 접기':'반지 고르기 펴기');
  $('grabtxt').textContent='▲ '+CAT[CI].name+' · 반지 고르기'; requestAnimationFrame(()=>{applyZoom();show(cur);if(open&&!$('pList').hidden)renderWheelKeep();});}
bG.addEventListener('pointerdown',e=>{gy=e.clientY;bG.setPointerCapture(e.pointerId)});
bG.addEventListener('pointerup',e=>{if(gy===null)return; const dy=e.clientY-gy; gy=null; const open=!sheet.classList.contains('collapsed');
  if(dy>30)setSheet(false); else if(dy<-30)setSheet(true); else setSheet(!open);});
addEventListener('resize',applyZoom);

applyLight(); makeThumbs(); rebuild(); renderTabs(); renderWheel(); show(N-1);
// 가만히 있어도 반짝이게: 파베 알이 하나씩 반짝이고, 큰 알과 조명이 아주 살짝 움직임 (초당 15번)
let lastTw=0, dragging=false;
st.addEventListener('pointerdown',()=>dragging=true); addEventListener('pointerup',()=>dragging=false);
function twinkle(now){requestAnimationFrame(twinkle);
  if(AUTO&&!document.hidden&&sx===null&&now>resumeAt&&now-lastPlay>100){lastPlay=now; let n=cur+playDir; if(n<PMIN||n>PMAX){playDir=-playDir;n=Math.max(PMIN,Math.min(PMAX,cur+playDir));} show(n);}
  if(document.hidden||dragging||now-lastTw<66||!MASK)return; lastTw=now; const t=now/1000;
  [ring,ring2].forEach(g=>{if(!g)return; const s=g.userData.stones; if(!s.visible||!s.count)return;
    for(let c=0;c<s.count;c++){const ph=(Math.abs(Math.sin(c*12.9898)*43758.5453)%1)*TAU, base=0.45+0.4*((Math.abs(Math.sin(c*7.13)*9137.1)%1));
      const k=base+0.9*Math.pow(Math.max(0,Math.sin(t*1.3+ph)),12), B=s.userData.base; s.setColorAt(c,B?TW.setRGB(B[c*3]*k,B[c*3+1]*k,B[c*3+2]*k):TW.setScalar(k));}
    s.instanceColor.needsUpdate=true;});
  if(head&&head.userData.slide){slideT=t; slideHead();}
  if(head&&head.userData.gem&&!head.userData.slide){const gm=head.userData.gem; gm.rotation.y=0.06*Math.sin(t*0.7); gm.rotation.x=0.04*Math.sin(t*1.1);}
  key.position.set(-0.4+0.35*Math.sin(t*0.5),1,0.8+0.2*Math.cos(t*0.4));
  renderer.render(scene,cam); composite(); shadow();}
requestAnimationFrame(twinkle);
// 테스트용
window.__show=show; window.__zoom=()=>bZ.click(); window.__pick=(id,o={})=>{pickRing(CAT.findIndex(c=>c.id===id)); Object.assign(window.__st,o); ({WMM,WALL,METAL,PAVE,GW,GPAVE,CUT,CT,GEM}={WMM,WALL,METAL,PAVE,GW,GPAVE,CUT,CT,GEM,...o}); rebuild(); show(cur);};
window.__st={};
