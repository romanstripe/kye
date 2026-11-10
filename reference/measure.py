# 프레임마다 반지 자리에서 손가락 양쪽 피부 경계를 직접 찾아 폭·가운데를 잰다 (고정 비율 없음)
import cv2,json,numpy as np,glob,re,sys
fs=sorted(glob.glob('f/*.jpg')); IM=[cv2.imread(f) for f in fs]; N=len(IM)
s=open('data13.js').read(); j=s.index('P='); e=s.index(']]',j); P=json.loads(s[j+2:e+2])
def profile(lab,c,n,ts):
    xs=(c[0]+n[0]*ts).astype(np.float32).reshape(1,-1); ys=(c[1]+n[1]*ts).astype(np.float32).reshape(1,-1)
    return cv2.remap(lab,xs,ys,cv2.INTER_LINEAR)[0].astype(float)
out=[]
for k in range(N):
    lab=cv2.cvtColor(cv2.GaussianBlur(IM[k],(5,5),0),cv2.COLOR_BGR2LAB)
    cx,cy,_,dx,dy,_,fr=P[k]; u=np.array([dx,-dy]) if False else np.array([dx,dy]); u/=np.linalg.norm(u); n=np.array([-u[1],u[0]])
    ts=np.arange(-70,70.5,0.5); W=[];C=[]
    for a in np.linspace(-10,10,9):
        c=np.array([cx,cy])+u*a; pr=profile(lab,c,n,ts)
        ref=pr[np.abs(ts)<6].mean(0); d=np.linalg.norm((pr-ref)*[0.6,1.2,1.2],axis=1)
        g=np.gradient(d)
        L=[];R=[]
        mR=(ts>8)&(ts<60); mL=(ts<-8)&(ts>-60)
        r=ts[mR][np.argmax(g[mR])]; l=ts[mL][np.argmin(g[mL])]
        W.append(r-l); C.append((r+l)/2)
    W=np.array(W);C=np.array(C); w=np.median(W); off=np.median(C)
    out.append([float(w),float(off)])
w=np.array([o[0] for o in out]); off=np.array([o[1] for o in out])
print('raw w',np.round(w,1)); print('fr*2',np.round([2*p[6] for p in P],1)); print('off',np.round(off,1))
json.dump(out,open('meas.json','w'))
# overlays
for k in [0,10,20,30,41]:
    im=IM[k].copy(); cx,cy,_,dx,dy,_,fr=P[k]; u=np.array([dx,dy]);u/=np.linalg.norm(u); n=np.array([-u[1],u[0]])
    c=np.array([cx,cy])+n*off[k]
    for sgn in [-1,1]:
        p=c+n*sgn*w[k]/2; cv2.circle(im,tuple(int(v) for v in p),3,(0,0,255),-1)
    for sgn in [-1,1]:
        p=np.array([cx,cy])+n*sgn*fr; cv2.circle(im,tuple(int(v) for v in p),3,(255,0,0),-1)
    x0,y0=int(cx)-90,int(cy)-90; cv2.imwrite(f'ms_{k}.png',cv2.resize(im[max(0,y0):y0+180,max(0,x0):x0+180],(270,270)))
