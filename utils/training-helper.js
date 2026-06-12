// utils/training-helper.js
// 训练相关的纯 helper 函数与常量。被 pages/training 和 pages/detail 共享。
// 这里只放无副作用、不依赖 Page 实例的函数。

// 环值 → 数值
const SCORE_VAL = s => s === 'X' ? 10 : s === 'M' ? 0 : parseInt(s)

// 环值 → 样式类（WA 122cm 靶纸配色）
function ARROW_CLS(a) {
  if (a === 'X')                    return 'x'
  if (a === '10' || a === '9')      return 'ten'
  if (a === '8' || a === '7')       return 'red'
  if (a === '6' || a === '5')       return 'blue'
  if (a === '4' || a === '3')       return 'dark'
  if (a === 'M')                    return 'miss'
  return 'white'
}

// 环值 → 色块（背景 + 文字色）
const SLOT_COLORS = {
  'X':  { bg: '#F5C518', text: '#1A1A2E' },
  '10': { bg: '#F5C518', text: '#1A1A2E' },
  '9':  { bg: '#F5C518', text: '#1A1A2E' },
  '8':  { bg: '#E63946', text: '#fff' },
  '7':  { bg: '#E63946', text: '#fff' },
  '6':  { bg: '#457B9D', text: '#fff' },
  '5':  { bg: '#457B9D', text: '#fff' },
  '4':  { bg: '#1D1D1D', text: '#fff' },
  '3':  { bg: '#1D1D1D', text: '#fff' },
  '2':  { bg: '#F5F5F5', text: '#1A1A2E' },
  '1':  { bg: '#F5F5F5', text: '#1A1A2E' },
  'M':  { bg: '#9CA3AF', text: '#fff' },
}

// 淘汰赛虚拟对手：用历史「每箭平均环值」拟合对手水平，再 ×3 换算成一组(3箭)。
// 改自旧版「只取 3 箭组」——强人平时打 6 箭排位、3 箭组样本太少会落回默认值导致对手过弱。
// 现在统计所有组的每箭环值（优先同距离+弓种，不足放宽到全部历史），既有样本又随水平成长。
// 返回（均按一组 3 箭计）：
//   mean — 平均水平   std — 一组的波动   best — 「最强的自己」（状态好时的水平，供决胜局用）
// 历史几乎为空时返回 mean=21/std=3/best=24（业余 7 环水平兜底）。
function calcOpponentLevel(history, distance, bowLabel) {
  const arrowsOf = recs => (recs || [])
    .filter(r => r.endResults)
    .flatMap(r => r.endResults)
    .flatMap(e => (e.arrows || []).map(SCORE_VAL))

  let vals = arrowsOf(history.filter(r => r.distance === distance && r.bowType === bowLabel))
  if (vals.length < 18) vals = arrowsOf(history)  // 同距离弓种不足 6 组(18箭) → 放宽到全部
  if (vals.length < 6) return { mean: 21, std: 3, best: 24, hasHistory: false }

  const n   = vals.length
  const avg = vals.reduce((a, b) => a + b, 0) / n                         // 每箭平均环
  const aStd = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / n) // 每箭标准差
  const bestArrow = Math.min(10, avg + 0.6 * aStd)                        // 状态好时的每箭水平
  const r1 = x => Math.round(x * 10) / 10
  return {
    mean: r1(avg * 3),
    std:  r1(Math.max(1.5, aStd * Math.sqrt(3))),  // 3 箭独立求和，标准差 ×√3
    best: r1(bestArrow * 3),
    hasHistory: true,
  }
}

// Box-Muller 变换：正态分布随机数（夹在 [0, 30]）
function randNormal(mean, std) {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.round(Math.min(30, Math.max(0, mean + z * std)))
}

// 秒数 → "M:SS"
function fmtSecs(s) {
  if (s <= 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m + ':' + (sec < 10 ? '0' + sec : sec)
}

// 秒数 → "无限制" / "30秒" / "3分钟" / "1分30秒"
function fmtTimeLabel(s) {
  if (s === 0) return '无限制'
  if (s < 60) return s + '秒'
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? m + '分钟' : m + '分' + rem + '秒'
}

module.exports = {
  SCORE_VAL,
  ARROW_CLS,
  SLOT_COLORS,
  calcOpponentLevel,
  randNormal,
  fmtSecs,
  fmtTimeLabel,
}
