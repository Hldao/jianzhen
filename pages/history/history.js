const api = require('../../utils/cloud')
const { handleErr } = require('../../utils/error')

// ── 图表工具 ──────────────────────────────────────────────────────
const DIST_COLOR = { '70m': '#2563EB', '30m': '#10B981', '18m': '#FF6B35', 'other': '#94A3B8' }
function distColor(d) { return DIST_COLOR[d] || DIST_COLOR.other }

// 云端旧版迁移记录可能缺少 dateStr / timeStr，在此补全
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function normalizeRecord(r) {
  const ts = r.ts || r.id || 0
  const d  = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return {
    ...r,
    _id:     r._id || String(ts),           // 保证 _id 存在
    ts,
    dateStr: r.dateStr || `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`,
    timeStr: r.timeStr || `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function buildChartData(records, range, metric) {
  const now = Date.now()
  const cutoff = range === 30 ? now - 30*86400000
               : range === 90 ? now - 90*86400000
               : 0
  const pts = records
    .filter(r => r.ts >= cutoff)
    .sort((a, b) => a.ts - b.ts)
    .map(r => {
      const d = new Date(r.ts)
      const label = `${d.getMonth()+1}/${d.getDate()}`
      const val = metric === 'avg'
        ? r.avgPerArrow
        : (r.totalArrows > 0
            ? Math.round(r.endResults.flatMap(e=>e.arrows).filter(a=>a==='X'||a==='10').length / r.totalArrows * 100)
            : 0)
      return { label, val, dist: r.distance, ts: r.ts }
    })
  if (!pts.length) return { pts: [], ma: [], min: 0, max: 10, trend: '' }

  // 7-point moving average
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

const PAGE_SIZE = 20

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    loading: false,
    records: [],            // 全量记录（用于 stats + chart 计算）
    displayRecords: [],     // 实际列表渲染用（分批，避免 100+ 卡片一次 setData）
    displayCount: PAGE_SIZE,
    totalSessions: 0,
    totalArrows: 0,
    overallAvg: 0,
    bestEnd: 0,
    // chart
    chartRange: 30,
    chartMetric: 'avg',
    chartTrend: '',
    chartEmpty: false,
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  onShow() {
    this._loadRecords()
  },

  async _loadRecords() {
    // ── Step 1：本地缓存秒开（同步读，无需等待网络）
    const cached = wx.getStorageSync('training_history') || []
    if (cached.length > 0) {
      this._applyRecords(cached.map(normalizeRecord))
    } else {
      this.setData({ loading: true })
    }

    // ── Step 2：云端静默刷新（stale-while-revalidate）
    try {
      const res = await api.training.list({ limit: 100 })
      const cloudRecords = (res.records || []).map(normalizeRecord)

      // 保留刚结束训练但尚未上传到云端的本地记录（防止短暂消失）
      const cloudTs = new Set(cloudRecords.map(r => r.ts))
      const pendingLocal = cached
        .map(normalizeRecord)
        .filter(r => !cloudTs.has(r.ts))
      const merged = [...pendingLocal, ...cloudRecords].sort((a, b) => b.ts - a.ts)

      // 刷新本地缓存，供下次秒开使用
      wx.setStorageSync('training_history', merged)
      this._applyRecords(merged)
    } catch (e) {
      handleErr('history.cloudRefresh', e)
      if (cached.length === 0) {
        wx.showToast({ title: '网络不可用', icon: 'none', duration: 2000 })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  // 计算统计量并渲染到页面
  _applyRecords(records) {
    const totalSessions = records.length
    const totalArrows   = records.reduce((s, r) => s + r.totalArrows, 0)
    const totalScore    = records.reduce((s, r) => s + r.totalScore, 0)
    const overallAvg    = totalArrows > 0 ? Math.round(totalScore / totalArrows * 10) / 10 : 0
    const bestEnd       = records.reduce((b, r) => r.bestEndTotal > b ? r.bestEndTotal : b, 0)
    // 列表分批渲染：初始只显示前 PAGE_SIZE 条卡片（避免一次 setData 100+ 卡片）
    const displayCount = this.data.displayCount || PAGE_SIZE
    const displayRecords = records.slice(0, displayCount)
    this.setData({
      records, displayRecords,
      totalSessions, totalArrows, overallAvg, bestEnd,
    }, () => {
      this._drawChart()
    })
  },

  // 上滑加载更多 · 从 records 全量中分批 slice 进 displayRecords
  onScrollToLower() {
    const newCount = Math.min(this.data.displayCount + PAGE_SIZE, this.data.records.length)
    if (newCount <= this.data.displayCount) return
    this.setData({
      displayCount: newCount,
      displayRecords: this.data.records.slice(0, newCount),
    })
  },

  setChartRange(e) {
    this.setData({ chartRange: +e.currentTarget.dataset.range }, () => this._drawChart())
  },

  setChartMetric(e) {
    this.setData({ chartMetric: e.currentTarget.dataset.metric }, () => this._drawChart())
  },

  _drawChart() {
    const { records, chartRange, chartMetric } = this.data
    const { pts, ma, min, max, trend } = buildChartData(records, chartRange, chartMetric)
    this.setData({ chartTrend: trend, chartEmpty: pts.length < 2 })
    if (pts.length < 2) return

    const query = wx.createSelectorQuery()
    query.select('#trend-canvas').fields({ node: true, size: true }).exec(res => {
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

    // grid lines
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

    // gradient fill
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

    // main line
    ctx.beginPath()
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(p.val)) : ctx.lineTo(xOf(i), yOf(p.val)))
    ctx.strokeStyle = '#FF6B35'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // moving average (dashed)
    ctx.beginPath()
    ma.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)))
    ctx.strokeStyle = 'rgba(37,99,235,.45)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // dots
    pts.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(xOf(i), yOf(p.val), 4, 0, Math.PI * 2)
      ctx.fillStyle = distColor(p.dist)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    // x-axis labels
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

  openDetail(e) {
    const rid = e.currentTarget.dataset.rid
    const record = this.data.records.find(r => r._id === rid)
    if (!record) return
    getApp().globalData.currentRecord = record
    wx.navigateTo({ url: '/pages/detail/detail' })
  },

  goBack() {
    wx.navigateBack()
  },

  goTraining() {
    wx.navigateTo({ url: '/pages/training/training' })
  },
})
