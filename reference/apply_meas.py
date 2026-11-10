# 잰 손가락 폭으로 P의 반지름(fr)과 가운데를 바꿈. 경계가 흐린 프레임은 추적 배율로 이어 붙이고 부드럽게
import json,numpy as np
s=open('data13.js').read(); j=s.index('P='); e=s.index(']]',j); P=json.loads(s[j+2:e+2])
M=np.array(json.load(open('meas.json'))); FL=json.load(open('flow.json')); N=len(P)
w=M[:,0]; off=M[:,1]; sc=np.array([f[4] for f in FL])
good=np.abs(off)<6   # 양쪽 경계의 가운데가 손가락 중심에서 6px 넘게 벗어나면 한쪽을 잘못 잡은 것
# 이웃과 25% 넘게 튀면 버림
med=np.array([np.median(w[max(0,k-3):k+4][good[max(0,k-3):k+4]]) if good[max(0,k-3):k+4].any() else w[k] for k in range(N)])
good&=np.abs(w-med)/med<0.25
idx=np.arange(N)
# 경계가 안 보인 프레임: 잘 잰 프레임들의 (폭 ÷ 추적 배율)을 이어서 추적 배율을 곱함
b=np.interp(idx,idx[good],(w/sc)[good]); wf=np.where(good,w,b*sc)
of=np.interp(idx,idx[good],off[good])
ker=np.array([1,2,3,2,1],float); ker/=ker.sum()
pad=lambda a:np.convolve(np.pad(a,2,mode='edge'),ker,'valid')
wf=pad(wf); of=pad(of)
print('good',good.sum(),'/',N); print(np.round(wf,1))
for k in range(N):
    cx,cy,cz,dx,dy,dz,fr=P[k]; u=np.array([dx,dy]); u/=np.linalg.norm(u); n=np.array([-u[1],u[0]])
    P[k][0]=round(cx+n[0]*of[k],3); P[k][1]=round(cy+n[1]*of[k],3); P[k][6]=round(wf[k]/2,3)
s=s[:j+2]+json.dumps(P)+s[e+2:]
open('data13.js','w').write(s)
