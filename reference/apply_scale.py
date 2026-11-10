# 손가락 폭은 잘 보이는 프레임들에서 한 번만 정하고(폭 ÷ 손 전체 배율의 중앙값), 나머지는 손 전체 배율(광학 흐름)에 맞춰 일정하게 바뀌게
import json,numpy as np
s=open('data13.v26.js').read(); j=s.index('P='); e=s.index(']]',j); P=json.loads(s[j+2:e+2])
M=np.array(json.load(open('meas.json'))); FL=json.load(open('flow.json')); N=len(P)
w=M[:,0]; off=M[:,1]; sc=np.array([f[4] for f in FL])
good=(np.abs(off)<6); good[:27]=False
C=np.median((w/sc)[good]); print('C',round(C,1),'good',good.sum())
wf=C*sc
of=np.zeros(N); of[good]=off[good]; of=np.convolve(np.pad(of,2,mode='edge'),np.ones(5)/5,'valid')
for k in range(N):
    cx,cy,cz,dx,dy,dz,fr=P[k]; u=np.array([dx,dy]); u/=np.linalg.norm(u); n=np.array([-u[1],u[0]])
    P[k][0]=round(cx+n[0]*of[k],3); P[k][1]=round(cy+n[1]*of[k],3); P[k][6]=round(wf[k]/2,3)
print(np.round(wf[27:],1))
open('data13.js','w').write(s[:j+2]+json.dumps(P)+s[e+2:])
