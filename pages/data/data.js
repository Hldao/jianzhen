const { handleErr } = require('../../utils/error')

const MAX_BAR_H = 160
const DIST_COLOR = { '70m': '#2563EB', '30m': '#10B981', '18m': '#FF6B35', 'other': '#94A3B8' }
function distColor(d) { return DIST_COLOR[d] || DIST_COLOR.other }

// ── 日期工具 ──────────────────────────────────────────────────────
function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWeekStart(d) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setHours(0, 0, 0, 0)
  mon.setDate(d.getDate() + diff)
  return mon
}

function getISOWeek(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7)
}

function formatSessionDate(ts) {
  const now = new Date()
  const d = new Date(ts)
  const diff = Math.round((new Date(toDateKey(now)) - new Date(toDateKey(d))) / 86400000)
  const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  if (diff === 0) return `今天 ${hm}`
  if (diff === 1) return `昨天 ${hm}`
  const days = ['周日','周一','周二','周三','周四','周五','周六']
  if (diff < 7) return `${days[d.getDay()]} ${hm}`
  return `${d.getMonth()+1}月${d.getDate()}日`
}

// ── 核心计算 ──────────────────────────────────────────────────────
function ts(r) { return r.ts ?? r.id }

function computeDataPage(records) {
  const now      = new Date()
  const todayKey = toDateKey(now)
  const monTs    = getWeekStart(now).getTime()
  const lastMonTs = monTs - 7 * 86400000

  const thisWeek = records.filter(r => ts(r) >= monTs)
  const lastWeek = records.filter(r => ts(r) >= lastMonTs && ts(r) < monTs)

  // 本周最高
  const weekBestRec = thisWeek.reduce(
    (best, r) => (!best || r.totalScore > best.totalScore) ? r : best, null
  )
  const lastBestRec = lastWeek.reduce(
    (best, r) => (!best || r.totalScore > best.totalScore) ? r : best, null
  )

  const weekBest     = weekBestRec ? weekBestRec.totalScore : null
  const weekBestMode = weekBestRec ? weekBestRec.mode : ''
  const weekBestMeta = weekBestRec
    ? `${weekBestRec.distance} · ${weekBestRec.bowType} · ${weekBestRec.targetSize}`
    : ''

  const rawDiff = weekBestRec && lastBestRec
    ? weekBestRec.totalScore - lastBestRec.totalScore
    : null
  const weekImproveTxt = rawDiff !== null
    ? (rawDiff >= 0 ? `+${rawDiff}` : String(rawDiff))
    : '--'
  const weekImproveUp = rawDiff !== null ? rawDiff >= 0 : true
  const showImprove   = rawDiff !== null

  // 柱状图：每天最高分
  const dayScoreMap = {}
  for (const r of thisWeek) {
    const key = toDateKey(new Date(ts(r)))
    if (!dayScoreMap[key] || r.totalScore > dayScoreMap[key]) {
      dayScoreMap[key] = r.totalScore
    }
  }

  const DAY_LABELS = ['周一','周二','周三','周四','周五','周六','周日']
  const barItems = Array.from({ length: 7 }, (_, i) => {
    const d      = new Date(monTs + i * 86400000)
    const key    = toDateKey(d)
    const isToday  = key === todayKey
    const isFuture = d.getTime() > now.getTime() && !isToday
    const score  = dayScoreMap[key] || 0
    return { day: isToday ? '今天' : DAY_LABELS[i], score, empty: score === 0, today: isToday, future: isFuture }
  })

  const maxScore = Math.max(...barItems.map(b => b.score), 1)
  const barData  = barItems.map(item => ({
    ...item,
    heightRpx: item.empty ? 6 : Math.round(item.score / maxScore * MAX_BAR_H),
  }))

  // 全局汇总
  const totalSessions = records.length
  const totalArrows   = records.reduce((s, r) => s + r.totalArrows, 0)
  const totalScore2   = records.reduce((s, r) => s + r.totalScore, 0)
  const overallAvg    = totalArrows > 0 ? Math.round(totalScore2 / totalArrows * 10) / 10 : 0
  // 最高成绩：只取排位赛(72箭整轮)的最高总分。
  // 排除自定义模式（用户可设 10 值箭/100环，污染口径）；单组最高(≤60)天花板低、意义弱。
  const rankingScores = records.filter(r => r.mode === '排名赛').map(r => r.totalScore)
  const bestScore     = rankingScores.length ? Math.max(...rankingScores) : null

  // 近期记录（最多 20 条，供折线图和列表使用）
  const sessions = records.slice(0, 20).map(r => ({
    ...r,
    _id:      r._id || String(ts(r)),
    date:     formatSessionDate(ts(r)),
    avgScore: r.totalArrows > 0 ? (r.totalScore / r.totalArrows).toFixed(1) : '--',
    ts:       ts(r),
  }))

  return {
    weekBest,
    weekBestDisplay: weekBest !== null ? String(weekBest) : '--',
    weekBestMode,
    weekBestMeta,
    weekCount:       thisWeek.length,
    weekImproveTxt,
    weekImproveUp,
    showImprove,
    weekLabel:       `第${getISOWeek(now)}周`,
    barData,
    sessions,
    // 全局汇总
    totalSessions,
    totalArrows,
    overallAvg,
    bestScoreDisplay: bestScore !== null ? String(bestScore) : '--',
    isEmpty:         records.length === 0,
    isWeekEmpty:     thisWeek.length === 0,
  }
}

// ── 折线图工具（复用 history 逻辑）───────────────────────────────
function buildChartData(records, range, metric) {
  const now = Date.now()
  const cutoff = range === 30 ? now - 30*86400000
               : range === 90 ? now - 90*86400000
               : 0
  const pts = records
    .filter(r => ts(r) >= cutoff)
    .sort((a, b) => ts(a) - ts(b))
    .map(r => {
      const d = new Date(ts(r))
      const label = `${d.getMonth()+1}/${d.getDate()}`
      const val = metric === 'avg'
        ? r.avgPerArrow
        : (r.totalArrows > 0
            ? Math.round(r.endResults.flatMap(e=>e.arrows).filter(a=>a==='X'||a==='10').length / r.totalArrows * 100)
            : 0)
      return { label, val, dist: r.distance, ts: ts(r) }
    })
  if (!pts.length) return { pts: [], ma: [], min: 0, max: 10, trend: '' }

  const ma = pts.map((_, i) => {
    const slice = pts.slice(Math.max(0, i-3), i+4)
    return slice.reduce((s, p) => s + p.val, 0) / slice.length
  })

  const vals = pts.map(p => p.val)
  const minV = Math.floor(Math.min(...vals) * 10 - 5) / 10
  const maxV = Math.ceil(Math.max(...vals)  * 10 + 5) / 10

  let trend = ''
  if (pts.length >= 4) {
    const half = Math.floor(pts.length / 2)
    const f = pts.slice(0, half).reduce((s,p)=>s+p.val,0)/half
    const s = pts.slice(half).reduce((s,p)=>s+p.val,0)/(pts.length-half)
    const d = metric === 'avg' ? (s-f).toFixed(1) : Math.round(s-f)
    const unit = metric === 'avg' ? '环' : '%'
    if (s - f > (metric==='avg'?0.1:2))      trend = `近期稳步提升 +${d}${unit}，保持！`
    else if (f - s > (metric==='avg'?0.1:2)) trend = `近期略有下滑 ${d}${unit}，注意调整`
    else                                      trend = `发挥稳定，波动极小`
  }

  return { pts, ma, min: minV, max: maxV, trend }
}

// ─────────────────────────────────────────────────────────────────
Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    loading: false,
    isEmpty: false,
    isWeekEmpty: false,

    // 全局汇总
    totalSessions: 0,
    totalArrows: 0,
    overallAvg: 0,
    bestScoreDisplay: '--',

    // 本周卡
    weekBestDisplay: '--',
    weekBestMode: '',
    weekBestMeta: '',
    weekCount: 0,
    weekImproveTxt: '--',
    weekImproveUp: true,
    showImprove: false,
    weekLabel: '',
    barData: [],
    sessions: [],

    // 折线图
    chartRange: 30,
    chartMetric: 'avg',
    chartTrend: '',
    chartEmpty: false,
  },

  // 内存里缓存原始记录，供折线图切换时复用
  _records: [],

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 1 })
    }
    this._load()
  },

  async _load() {
    const api = require('../../utils/cloud')

    // ── Step 1：本地缓存秒开
    const cached = wx.getStorageSync('training_history') || []
    if (cached.length > 0) {
      this._records = cached
      this._applyRecords(cached)
    } else {
      this.setData({ loading: true })
    }

    // ── Step 2：云端静默刷新
    // 图表只用近期 30/90 天数据 + sessions slice(0,20)，60 条足够
    try {
      const res = await api.training.list({ limit: 60 })
      const cloudRecords = res.records || []

      // 保留刚完成但尚未同步的本地新记录
      const cloudTs = new Set(cloudRecords.map(r => ts(r)))
      const pending = cached.filter(r => !cloudTs.has(ts(r)))
      const merged  = [...pending, ...cloudRecords].sort((a, b) => ts(b) - ts(a))

      wx.setStorageSync('training_history', merged)
      this._records = merged
      this._applyRecords(merged)
    } catch (e) {
      handleErr('data.cloudRefresh', e)
      if (cached.length === 0) {
        wx.showToast({ title: '网络不可用', icon: 'none', duration: 2000 })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  _applyRecords(records) {
    this.setData(computeDataPage(records), () => {
      this._drawChart()
    })
  },

  // ── 折线图 ────────────────────────────────────────────────────
  setChartRange(e) {
    this.setData({ chartRange: +e.currentTarget.dataset.range }, () => this._drawChart())
  },

  setChartMetric(e) {
    this.setData({ chartMetric: e.currentTarget.dataset.metric }, () => this._drawChart())
  },

  _drawChart() {
    const { chartRange, chartMetric } = this.data
    const { pts, ma, min, max, trend } = buildChartData(this._records, chartRange, chartMetric)
    this.setData({ chartTrend: trend, chartEmpty: pts.length < 2 })
    if (pts.length < 2) return

    const query = wx.createSelectorQuery()
    query.select('#data-trend-canvas').fields({ node: true, size: true }).exec(res => {
      if (!res[0] || !res[0].node) return
      const canvas = res[0].node
      const W = res[0].width, H = res[0].height
      const dpr = wx.getSystemInfoSync().pixelRatio
      canvas.width  = W * dpr
      canvas.height = H * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      this._renderChart(ctx, W, H, pts, ma, min, max, chartMetric)
    })
  },

  _renderChart(ctx, W, H, pts, ma, min, max, metric) {
    const PAD_L = 40, PAD_R = 16, PAD_T = 16, PAD_B = 36
    const cW = W - PAD_L - PAD_R
    const cH = H - PAD_T - PAD_B
    const range = max - min || 1

    const xOf = i => PAD_L + (i / (pts.length - 1)) * cW
    const yOf = v => PAD_T + (1 - (v - min) / range) * cH

    ctx.clearRect(0, 0, W, H)

    // 网格线
    for (let k = 0; k <= 2; k++) {
      const v = min + (range * k / 2)
      const y = yOf(v)
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(232,236,242,.9)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#94A3B8'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(metric === 'avg' ? v.toFixed(1) : Math.round(v), PAD_L - 4, y + 4)
    }

    // 渐变填充
    const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + cH)
    grad.addColorStop(0, 'rgba(255,107,53,.18)')
    grad.addColorStop(1, 'rgba(255,107,53,0)')
    ctx.beginPath()
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(p.val)) : ctx.lineTo(xOf(i), yOf(p.val)))
    ctx.lineTo(xOf(pts.length-1), PAD_T + cH)
    ctx.lineTo(xOf(0), PAD_T + cH)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // 主折线
    ctx.beginPath()
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(p.val)) : ctx.lineTo(xOf(i), yOf(p.val)))
    ctx.strokeStyle = '#FF6B35'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 均线（虚线）
    ctx.beginPath()
    ma.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)))
    ctx.strokeStyle = 'rgba(37,99,235,.45)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // 数据点
    pts.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(xOf(i), yOf(p.val), 4, 0, Math.PI * 2)
      ctx.fillStyle = distColor(p.dist)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    // X 轴标签
    ctx.fillStyle = '#94A3B8'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(pts.length / 5))
    pts.forEach((p, i) => {
      if (i % step === 0 || i === pts.length - 1) {
        ctx.fillText(p.label, xOf(i), H - PAD_B + 18)
      }
    })
  },

  // ── 点击近期记录跳详情 ────────────────────────────────────────
  openSession(e) {
    const rid = e.currentTarget.dataset.rid
    const record = this.data.sessions.find(r => r._id === rid)
    if (!record) return
    getApp().globalData.currentRecord = record
    wx.navigateTo({ url: '/pages/detail/detail' })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goTraining() {
    wx.navigateTo({ url: '/pages/training/training' })
  },

  onShareAppMessage() {
    return getApp().defaultShare()
  },
})
