// @ts-nocheck  (reference/main13.js 의 layoutStones 를 모양·수치 그대로 옮김)
import * as THREE from 'three'
import { S, H, TAU, wrap } from './shared.ts'
import { spB, HK } from './makeRing.ts'

// 파베 알 배치. cfg: ys(폭 방향 위치 -0.5~0.5) / d(알 지름 mm) / arc(1=한 바퀴, 0.5=손등 쪽 절반) / count(고정 개수) / grid(무늬 칸 피치 mm, 칸 가운데에 알) / skip(n칸마다 하나)
export function layoutStones(g,cfg,yk){
  const {tR,pe,W}=g.userData, R=S.FD/2, st=g.userData.stones, m=new THREE.Matrix4(), q=new THREE.Quaternion(), up=new THREE.Vector3(0,1,0);
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
