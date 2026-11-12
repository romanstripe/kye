// 손 점 21개(x, y, z) 전체를 앞뒤 프레임과 5프레임 평균 [1,2,3,2,1] 으로 부드럽게.
// 프레임마다 따로 읽은 점은 조금씩 흔들려서, 그대로 반지 자리를 잡으면 반지만 따로 떠는 것처럼 보임.
// 이웃 프레임에 손이 없으면(null) 있는 프레임끼리만 가중치를 다시 맞춰 평균함. 내 프레임에 손이 없으면 그대로 null.
const W = [1, 2, 3, 2, 1]

export function smoothLandmarks(lms: (number[][] | null)[]): (number[][] | null)[] {
  return lms.map((cur, i) => {
    if (!cur) return null
    return cur.map((_, k) => {
      const out = [0, 0, 0]
      let wsum = 0
      for (let d = -2; d <= 2; d++) {
        const L = lms[i + d]
        if (!L) continue
        const w = W[d + 2]
        wsum += w
        for (let c = 0; c < 3; c++) out[c] += L[k][c] * w
      }
      return out.map((x) => x / wsum)
    })
  })
}
