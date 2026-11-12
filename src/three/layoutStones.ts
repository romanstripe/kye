// @ts-nocheck  (원본 데모 의 layoutStones 를 모양·수치 그대로 옮김)
import * as THREE from 'three'
import { S, H, TAU, wrap } from './shared.ts'
import { spB, spAt, HK, mvPt, mvEven } from './makeRing.ts'

// 파베 알 배치. cfg: ys(폭 방향 위치 -0.5~0.5) / d(알 지름 mm) / arc(1=한 바퀴, 0.5=손등 쪽 절반) / count(고정 개수) / grid(무늬 칸 피치 mm, 칸 가운데에 알) / skip(n칸마다 하나)
export function layoutStones(g,cfg,yk){
  const {tR,pe,W}=g.userData, R=S.FD/2, st=g.userData.stones, m=new THREE.Matrix4(), q=new THREE.Quaternion(), up=new THREE.Vector3(0,1,0);
  const d=cfg.d, rowsN=cfg.ys?cfg.ys.length:Math.max(1,Math.floor(W*0.9/(d*1.12)));
  const ys=cfg.ys||Array.from({length:rowsN},(_,i)=>rowsN===1?0:(i/(rowsN-1)-0.5)*(W*0.9-d)/W);
  let sz=(d/2)/R; const bead=st.userData.beads; let c=0, b=0;
  const base=st.userData.base||(st.userData.base=new Float32Array(2700));
  const put=(th,f,rr,ri,hp)=>{if(c>=900)return; const dir=new THREE.Vector3(Math.cos(th),0,Math.sin(th)); q.setFromUnitVectors(up,dir).multiply(new THREE.Quaternion().setFromAxisAngle(up,(c*2.399)%TAU));
      m.compose(dir.clone().multiplyScalar(rr).setY(f*H*yk),q,new THREE.Vector3(sz,sz,sz)); st.setMatrixAt(c,m);
      const col=cfg.colors?new THREE.Color(cfg.colors[c%cfg.colors.length]):new THREE.Color(1,1,1); base[c*3]=col.r;base[c*3+1]=col.g;base[c*3+2]=col.b;
      const h=0.45+0.75*(Math.abs(Math.sin(c*12.9898+ri*78.233)*43758.5453)%1); st.setColorAt(c++,col.multiplyScalar(cfg.colors?Math.min(1,h+0.3):h));
      const bsz=sz*0.2; [-1,1].forEach(sg=>{if(b>=1800||cfg.noBeads)return; const a=th+hp, dv=new THREE.Vector3(Math.cos(a),0,Math.sin(a)); m.compose(dv.multiplyScalar(rr+sz*0.12).setY(f*H*yk+sg*sz*0.55),q,new THREE.Vector3(bsz,bsz,bsz)); bead.setMatrixAt(b++,m);});};
  if(cfg.quilt){ // 코코퀼트: 퀼팅 선(금)은 남기고 마름모 칸 안에만 알
    const n=g.userData.cc.n, u=W/2, lift=(v)=>1+tR*(0.3+0.7*Math.pow(Math.sin(Math.PI*v),pe))+0.012-sz*0.1;
    // 실물처럼: 칸마다 가운데 큰 알 하나 + 둘레를 작은 알로 빽빽하게. front = 앞쪽 몇 칸, alt = 한 칸 걸러, 기본 = 모든 칸
    const cells=[]; for(let k=0;k<n;k+=2){cells.push([k,1,(k/2)%2]); cells.push([k+1,0,((k/2)+1)%2],[k+1,2,((k/2)+1)%2]);}
    const big=d*1.75, sm=d*0.8, rc=(big/2+sm*0.4)/u;
    cells.forEach(([sc,yc,par],ci)=>{
      const th0=sc/n*TAU; if(cfg.front&&Math.abs(wrap(th0-Math.PI/2+Math.PI)-Math.PI)>0.75)return; if(cfg.alt&&par)return;
      if(yc===1){sz=(big/2)/R; put(wrap(th0),0,lift(0.5)+0.012,ci,0.02);}
      sz=(sm/2)/R; const st=sm*0.9/u, m=0.14/u+st*0.35;
      for(let dy=-1;dy<=1;dy+=st*0.88)for(let ds=-1;ds<=1;ds+=st){const y=yc+dy, s=sc+ds+((Math.round((dy+1)/(st*0.88)))%2?st/2:0);
        if(y<0.12||y>1.88)continue; if(Math.abs(s-sc)+Math.abs(y-yc)>1-m)continue; if(yc===1&&Math.hypot(s-sc,(y-yc))<rc)continue; const v=y/2; put(wrap(s/n*TAU),v-0.5,lift(v),ci,0.02);}});
    ys.length=0;}
  if(cfg.mv){ const mv=g.userData.mv, Rr=R+mv.r, rr=(Rr+mv.r)/R-sz*0.2, n=Math.floor(mvEven(mv,1).per/(d*1.05));
    mvEven(mv,n).f.forEach((f,k)=>{const [px,py]=mvPt(mv,f); put(Math.PI/2+px/Rr, py/W, rr, k, 0.02);});
    if(!cfg.front){const t0=Math.PI/2+mv.a/Rr+d/Rr, t1=Math.PI/2-mv.a/Rr+TAU-d/Rr, m=Math.floor((t1-t0)*Rr/(d*1.05)); for(let k=0;k<=m;k++) put(t0+(t1-t0)*k/m,0,(Rr+mv.rb)/R-sz*0.2,k,0.02);}
    ys.length=0;}
  if(cfg.scales){ const sc=g.userData.sp;
    for(let k=0;k<sc.n;k++){ if(cfg.alt&&k%2)continue;
      [0.22,0.4,0.6,0.78].forEach((v,ri)=>{const a=spB(sc,k,v), b=spB(sc,k+1,v), w=(b-a)*sc.p-0.5, m=Math.max(1,Math.floor(w/(d*1.05)));
        for(let i=0;i<m;i++){const u=a+(b-a)*(0.5+(i-(m-1)/2)*(d*1.05)/((b-a)*sc.p)); put(u/sc.n*TAU,v-0.5,1+tR*(0.3+0.7*Math.pow(Math.sin(Math.PI*v),pe))+0.03-sz*0.1,ri,0.02);}});}
    ys.length=0;}
  if(cfg.spFill){const sc=g.userData.sp; cfg={...cfg,arc:1,fill:{test:(th,v)=>{if(v<0.1||v>0.9)return false; const q=spAt(sc,th,v); return q.dmm>0.32&&!(cfg.alt&&q.k%2);},h:()=>0.03}};}
  if(cfg.icFill){const n=Math.round(TAU*R/(W/2)); cfg={...cfg,arc:1,fill:{test:(th,v)=>{const u=wrap(th)/TAU*n, fu=u-Math.floor(u), fv=(v*2)%1, m=0.2/(W/2); if(cfg.alt&&(Math.floor(u)+Math.floor(v*2))%2)return false; return fu>m&&fu<1-m&&fv>m&&fv<1-m&&v>0.04&&v<0.96;},h:()=>0.025}};}
  if(cfg.clFill){const p=W*0.95, n=2*Math.round(TAU*R/p/2); cfg={...cfg,arc:1,fill:{test:(th,v)=>{const u=wrap(th)/TAU*n, i=Math.floor(u), fu=u-i-0.5, fv=v-0.5; if(Math.abs(fv)>0.42)return false;
      return i%2? (cfg.clFill==='all'&&Math.max(Math.abs(fu),Math.abs(fv))<0.33) : fu*fu+fv*fv<0.13;},
    h:(th,v)=>{const u=wrap(th)/TAU*n, i=Math.floor(u), fu=u-i-0.5, fv=v-0.5; return i%2? 0.13*Math.max(0,1-2.6*Math.max(Math.abs(fu),Math.abs(fv)))-0.02 : 0.11*Math.sqrt(Math.max(0,1-6*(fu*fu+fv*fv)))-0.02;}}};}
  if(cfg.fill){ // 영역 채우기: 작은 알을 벌집처럼 빽빽하게, 칸(영역) 안에만. test(th,v)=칸 안인지, h(th,v)=그 자리 표면 높이
    const {test,h}=cfg.fill, dy=d*0.88, nyr=Math.floor(W/dy);
    for(let j=0;j<=nyr;j++){const y=-W/2+(W-nyr*dy)/2+j*dy, v=y/W+0.5, nx=Math.floor(TAU*R/(d*1.0));
      for(let k=0;k<nx;k++){const th=(k+(j%2)*0.5)/nx*TAU; if(cfg.arc<1){const dd=Math.abs(wrap(th-Math.PI/2+Math.PI)-Math.PI); if(dd>cfg.arc*Math.PI)continue;}
        if(!test(th,v))continue; const e=Math.sin(Math.PI*v); put(th,v-0.5,1+tR*(0.3+0.7*Math.pow(e,pe))+h(th,v)*Math.pow(e,0.8)+0.012,j,0.02);}}
    ys.length=0;}
  if(cfg.bz){ // 비제로투: 엣지 = 튀어나온 양쪽 테두리 위에 한 줄씩, 풀 = 가운데 통통한 띠에 2줄
    const {nb,E}=g.userData.bz, er=1+tR*(1.5/1.05)+0.07, cw=(1-2*E)/nb, rows=[];
    if(cfg.bz!=='full') rows.push([-0.5+E/2,er,1.0],[0.5-E/2,er,1.0]);          // 엣지: 테두리 알은 1mm
    if(cfg.bz!=='edge') for(let k=0;k<nb;k++) rows.push([-0.5+E+cw*(k+0.5),1+tR+0.01,d]);
    rows.forEach(([f,rr,dd],ri)=>{sz=(dd/2)/R; const n=Math.floor(TAU*R*rr/(dd*1.05)); for(let k=0;k<n;k++) put((k+(ri%2)*0.5)/n*TAU,f,rr+sz*0.1,ri,0.02);});
    ys.length=0;}
  if(cfg.love){ // 러브볼트 풀 파베: 3줄로 꽉, 나사 원(금)은 비워 둠
    const rs=0.3*W, ns=6, rr=1+tR+sz*0.25, n=Math.floor(TAU*R/(d*1.04));   // 알을 살짝 띄워 옆면 반짝임이 보이게
    [-1,0,1].forEach((row,ri)=>{const y=row*W/3, v=y/W+0.5;
      for(let k=0;k<n;k++){const th=(k+(ri%2)*0.5)/n*TAU, c=Math.round(th/TAU*ns)%ns, x=(wrap(th-c/ns*TAU+Math.PI)-Math.PI)*R;
        if(Math.hypot(x,y)<rs+d*0.5)continue; put(th,v-0.5,rr,ri,Math.PI/n);}});
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
    else if(cfg.count){for(let k=0;k<cfg.count;k++) ths.push((k+(cfg.countOff??0.5))/cfg.count*TAU);}
    else {const n=Math.floor(TAU*R*rr/(d*(cfg.gap||1.08))); for(let k=0;k<n;k++) ths.push((k+(ri%2)*0.5)/n*TAU);}
    const hp=ths.length>1?(ths[1]-ths[0])/2:0.1, bsz=sz*0.2;
    ths.forEach(th=>{ if(cfg.arc<1){const dd=Math.abs(wrap(th-Math.PI/2+Math.PI)-Math.PI); if(dd>cfg.arc*Math.PI) return;}
      put(th,f,rr,ri,hp);});});
  bead.count=b; bead.instanceMatrix.needsUpdate=true;
  if(st.instanceColor)st.instanceColor.needsUpdate=true;
  st.count=c; st.instanceMatrix.needsUpdate=true;}
