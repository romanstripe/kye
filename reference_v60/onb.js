// ---- 처음 화면들: 환영 → 촬영 안내 → 손 모양 선에 맞춰 찍기 (데모는 예시 손으로 흉내)
(function(){
const G=34, $o=id=>document.getElementById(id), scr={land:$o('o-land'),tut:$o('o-tut'),cam:$o('o-cam')};
function go(k){Object.entries(scr).forEach(([n,el])=>el.hidden=n!==k); if(k==='cam')startCam(); else stopCam();}
function done(){Object.values(scr).forEach(el=>el.hidden=true); stopCam(); show(G);}
$o('o-landimg').src=F[G]; $o('o-camimg').src=F[G];
// 손 윤곽: 관절(LMS)을 굵은 선으로 이어 손 모양을 칠하고, 그 테두리만 남김
function handMask(L,fr,cv){const x=cv.getContext('2d'); x.clearRect(0,0,cv.width,cv.height); x.fillStyle=x.strokeStyle='#fff'; x.lineCap=x.lineJoin='round';
  const p=i=>L[i], seg=(a,b,w)=>{x.lineWidth=w;x.beginPath();x.moveTo(p(a)[0],p(a)[1]);x.lineTo(p(b)[0],p(b)[1]);x.stroke();};
  const fw=fr*2.05; [[1,2,3,4,1.2],[5,6,7,8,1.0],[9,10,11,12,1.05],[13,14,15,16,1.0],[17,18,19,20,0.85]].forEach(([a,b,c,d,k])=>{seg(a,b,fw*k*1.1);seg(b,c,fw*k);seg(c,d,fw*k*0.92);
    const t=[p(d)[0]+(p(d)[0]-p(c)[0])*0.35,p(d)[1]+(p(d)[1]-p(c)[1])*0.35]; x.lineWidth=fw*k*0.85; x.beginPath();x.moveTo(p(d)[0],p(d)[1]);x.lineTo(t[0],t[1]);x.stroke();});
  x.beginPath(); [0,1,2,5,9,13,17].forEach((i,n)=>n?x.lineTo(p(i)[0],p(i)[1]):x.moveTo(p(i)[0],p(i)[1])); x.closePath(); x.fill(); x.lineWidth=fw*0.9; x.stroke();
  const d=[p(0)[0]-p(9)[0],p(0)[1]-p(9)[1]], wl=1.1; x.lineWidth=Math.hypot(p(5)[0]-p(17)[0],p(5)[1]-p(17)[1])*0.85; x.beginPath();x.moveTo(p(0)[0],p(0)[1]);x.lineTo(p(0)[0]+d[0]*wl,p(0)[1]+d[1]*wl);x.stroke();}
function drawGuide(cv,L,fr,ok,line){const W=cv.width,H=cv.height,m=document.createElement('canvas');m.width=W;m.height=H;handMask(L,fr,m);
  const x=cv.getContext('2d'); x.clearRect(0,0,W,H);
  x.globalAlpha=0.14; x.drawImage(m,0,0); x.globalAlpha=1;
  const o=document.createElement('canvas');o.width=W;o.height=H;const ox=o.getContext('2d');
  for(let a=0;a<16;a++){const t=a/16*Math.PI*2; ox.drawImage(m,Math.cos(t)*line,Math.sin(t)*line);}
  ox.globalCompositeOperation='destination-out'; ox.drawImage(m,0,0); ox.globalCompositeOperation='source-in'; ox.fillStyle=ok?'#7CF0A6':'#ffffff'; ox.fillRect(0,0,W,H);
  x.shadowColor='rgba(0,0,0,.35)'; x.shadowBlur=6; x.drawImage(o,0,0); x.shadowBlur=0;
  // 반지 낄 자리: 13→14 사이, 손가락을 가로지르는 짧은 선
  const a=L[13],b=L[14],cx=(a[0]*0.55+b[0]*0.45),cy=(a[1]*0.55+b[1]*0.45),dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy),px=-dy/n,py=dx/n,h=fr*1.25;
  x.strokeStyle=ok?'#7CF0A6':'#FFD25A'; x.lineWidth=line*1.6; x.lineCap='round'; x.beginPath(); x.moveTo(cx-px*h,cy-py*h); x.lineTo(cx+px*h,cy+py*h); x.stroke();}
const L=LMS[G], fr=P[G][6];
drawGuide($o('o-guide'),L,fr,false,3);
// 안내 첫 번째 그림: 같은 손 윤곽을 작게
function drawIc(){const c=$o('o-ic1'),xs=L.map(q=>q[0]),ys=L.map(q=>q[1]),x0=Math.min(...xs)-40,y0=Math.min(...ys)-30,s=Math.max(Math.max(...xs)-x0+40,Math.max(...ys)-y0+90),
  big=document.createElement('canvas');big.width=480;big.height=854;drawGuide(big,L,fr,false,4); const x=c.getContext('2d'); x.fillStyle='#ecebe8';x.fillRect(0,0,128,128);
  x.drawImage(F_img(),x0,y0,s,s,0,0,128,128); x.drawImage(big,x0,y0,s,s,0,0,128,128);}
const _ci=new Image(); _ci.onload=()=>{const c=$o('o-ic1').getContext('2d'); drawIcWith(_ci);}; 
function drawIcWith(im){F_img=()=>im; drawIc();} _ci.src=F[G];
let F_img=()=>$o('o-camimg');
let stream=null, vid=$o('o-video');
async function startCam(){setState('ready');
  try{ if(!navigator.mediaDevices)throw 0; stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
    vid.srcObject=stream; vid.hidden=false; await vid.play(); $o('o-camimg').hidden=true; $o('o-note').hidden=true; drawGuide($o('o-guide'),L,fr,false,3);}
  catch(e){vid.hidden=true; $o('o-camimg').hidden=false; $o('o-note').hidden=false; setTimeout(()=>{if(!scr.cam.hidden&&phase==='ready'){drawGuide($o('o-guide'),L,fr,true,3); $o('o-title').textContent='좋아요, 딱 맞아요'; $o('o-sub').textContent='이제 아래 버튼을 눌러 3초만 찍어요';}},900);}}
function stopCam(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;} vid.hidden=true;}
let phase='ready', tmr=null;
function setState(p){phase=p; const sb=$o('o-shoot'),st=$o('o-state'),ar=$o('o-arrow'),pg=$o('o-prog');
  sb.classList.toggle('rec',p==='rec'); ar.hidden=p!=='rec'; st.hidden=p==='ready'||p==='rec'; pg.style.transition='none'; pg.style.strokeDashoffset='232.5';
  if(p==='ready'){$o('o-title').textContent='손을 선 안에 맞춰 주세요'; $o('o-sub').textContent='반지 낄 손가락(넷째)에 표시된 자리를 맞추면 돼요'; drawGuide($o('o-guide'),L,fr,false,3); sb.setAttribute('aria-label','촬영 시작');}
  if(p==='rec'){$o('o-title').textContent='천천히 좌우로 돌려요'; $o('o-sub').textContent='손 거리는 그대로, 30° 정도만'; sb.setAttribute('aria-label','촬영 멈춤');
    requestAnimationFrame(()=>{pg.style.transition='stroke-dashoffset 3s linear'; pg.style.strokeDashoffset='0';});
    let k=0; const seq=[30,32,34,36,38,40,41,40,38,36,34,32,30,28,27,28,30,32,34]; const im=$o('o-camimg');
    tmr=setInterval(()=>{k++; if(k<seq.length&&vid.hidden){im.src=F[seq[k]];} },3000/seq.length);
    setTimeout(()=>{clearInterval(tmr); if(phase==='rec')setState('proc');},3000);}
  if(p==='proc'){st.textContent='손가락을 찾고 있어요…'; $o('o-title').textContent='다 찍었어요'; $o('o-sub').textContent='잠깐만 기다려 주세요'; $o('o-camimg').src=F[G];
    setTimeout(()=>{if(phase==='proc'){done();}},1400);}}
$o('o-shoot').onclick=()=>{if(phase==='ready')setState('rec'); else if(phase==='rec'){clearInterval(tmr); setState('ready');}};
$o('o-start').onclick=()=>go('tut'); $o('o-demo').onclick=done; $o('o-go').onclick=()=>go('cam'); $o('o-back1').onclick=()=>go('land');
$o('o-x').onclick=()=>{clearInterval(tmr); setState('ready'); go('tut');};
const rs=$o('b-reshoot'); if(rs) rs.onclick=()=>{setState('ready'); go('cam');};
window.__onb=go;
})();
