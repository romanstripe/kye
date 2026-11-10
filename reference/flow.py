import cv2,json,numpy as np,glob
fs=sorted(glob.glob('f/*.jpg')); G=[cv2.cvtColor(cv2.imread(f),cv2.COLOR_BGR2GRAY) for f in fs]; N=len(G)
P=json.load(open('../vid4/poses_ref.json')) if False else None
A=np.array(json.load(open('lm.json')))
REF=N-1
L=A[REF]; seg=L[14]-L[13]; c0=(L[13]+0.5*seg)[:2]; u=seg[:2]/np.linalg.norm(seg[:2]); fr0=0.47*np.linalg.norm(seg[:2])/2
# points on the finger around ring: grid within finger, along axis +-1.2*fr, across +-0.7*fr
pts=[]
for a in np.linspace(-1.6,1.6,9):
    for b in np.linspace(-0.7,0.7,5):
        pts.append(c0+u*a*fr0+np.array([-u[1],u[0]])*b*fr0)
pts=np.float32(pts).reshape(-1,1,2)
gp=cv2.goodFeaturesToTrack(G[REF],60,0.005,4,mask=None)
# restrict good features to finger region
m=np.zeros_like(G[REF]); 
poly=np.int32([c0+u*s1*2.2*fr0+np.array([-u[1],u[0]])*s2*0.85*fr0 for s1,s2 in [(-1,-1),(-1,1),(1,1),(1,-1)]])
cv2.fillPoly(m,[poly],255)
gp=cv2.goodFeaturesToTrack(G[REF],80,0.003,3,mask=m)
if gp is not None: pts=np.concatenate([pts,gp.astype(np.float32)])
print('pts',len(pts))
lk=dict(winSize=(21,21),maxLevel=3,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,30,0.01))
T=[None]*N; T[REF]=np.array([[1,0,0],[0,1,0]],float)
def run(order):
    cur=pts.copy(); prevG=G[REF]; ok=np.ones(len(pts),bool)
    for k in order:
        nxt,st,_=cv2.calcOpticalFlowPyrLK(prevG,G[k],cur,None,**lk)
        back,st2,_=cv2.calcOpticalFlowPyrLK(G[k],prevG,nxt,None,**lk)
        fb=np.linalg.norm((back-cur).reshape(-1,2),axis=1)
        ok&=(st.ravel()==1)&(st2.ravel()==1)&(fb<1.0)
        M,inl=cv2.estimateAffinePartial2D(pts[ok],nxt[ok],method=cv2.RANSAC,ransacReprojThreshold=2.0)
        T[k]=M; cur=nxt; prevG=G[k]
        if ok.sum()<8: print('low',k,ok.sum())
run(range(REF-1,-1,-1))
out=[]
for k in range(N):
    M=T[k]; c=M@np.array([c0[0],c0[1],1]); s=np.hypot(M[0,0],M[1,0]); R=M[:,:2]/s; uk=R@u
    out.append([float(c[0]),float(c[1]),float(uk[0]),float(uk[1]),float(s)])
json.dump(out,open('flow.json','w'))
for k in range(0,N,5): print(k,[round(v,2) for v in out[k]])
