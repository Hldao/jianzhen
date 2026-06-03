// WA 标准 122cm 靶纸：X/10/9 黄  ·  8/7 红  ·  6/5 蓝  ·  4/3 黑  ·  2/1 白
const ARROW_CLS = a => {
  if (a === 'X')                    return 'x'
  if (a === '10' || a === '9')      return 'ten'
  if (a === '8' || a === '7')       return 'red'
  if (a === '6' || a === '5')       return 'blue'
  if (a === '4' || a === '3')       return 'dark'
  if (a === 'M')                    return 'miss'
  return 'white'
}

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

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    record: null,
    xTenCount: 0,
    xTenPct: 0,
    arrowDisplay: [],
    insights: [],
    editingNote: false,
    noteInput: '',

    // 分享
    sharing: false,
    showShare: false,
    shareImagePath: '',
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
    const record = app.globalData.currentRecord
    if (!record) { wx.navigateBack(); return }
    this._processRecord(record)
  },

  onUnload() {
    getApp().globalData.currentRecord = null
    // 清理保存到相册成功后的延迟 hide 计时器，避免 setData on dead page
    if (this._hideShareTimer) clearTimeout(this._hideShareTimer)
  },

  _processRecord(record) {
    const endResults = record.endResults || []
    if (!endResults.length) { wx.navigateBack(); return }

    const totalArrows = record.totalArrows || 0
    const allArrows = endResults.flatMap(e => e.arrows)
    const xTenCount = allArrows.filter(a => a === 'X' || a === '10').length
    const xTenPct = totalArrows > 0 ? Math.round(xTenCount / totalArrows * 100) : 0

    let bestIdx = 0
    endResults.forEach((e, i) => { if (e.total > endResults[bestIdx].total) bestIdx = i })

    const arrowDisplay = endResults.map((end, i) => ({
      endNum: end.endNum,
      total:  end.total,
      isBest: i === bestIdx,
      slots:  end.arrows.map(a => ({ score: a, cls: ARROW_CLS(a) })),
    }))

    const insights = []
    const best = endResults[bestIdx]

    // ── 1. X/10 精准度（always）
    if (xTenPct >= 30)      insights.push(`X/10环占比 ${xTenPct}%，精准度相当出色`)
    else if (xTenPct >= 15) insights.push(`X/10环占比 ${xTenPct}%，精准度稳步提升中`)
    else                    insights.push(`X/10环占比 ${xTenPct}%，建议加强靶心区域命中训练`)

    // ── 2. 脱靶提醒（conditional：有 M 时才出现）
    const missCount = allArrows.filter(a => a === 'M').length
    if (missCount >= 2)     insights.push(`出现 ${missCount} 次脱靶，建议检查撒放时机与弓臂稳定性`)
    else if (missCount === 1) insights.push('出现 1 次脱靶，注意保持瞄准稳定')

    // ── 3. 前后半段体力曲线（4 组及以上才计算）
    if (endResults.length >= 4) {
      const half = Math.floor(endResults.length / 2)
      const firstScore  = endResults.slice(0, half).reduce((s, e) => s + e.total, 0)
      const secondScore = endResults.slice(half).reduce((s, e) => s + e.total, 0)
      const diff = secondScore - firstScore
      if (diff > 4)       insights.push(`后半段比前半段多得 ${diff} 环，体力与专注度全程在线`)
      else if (diff < -4) insights.push(`后半段比前半段少得 ${Math.abs(diff)} 环，注意保持训练后半段的稳定`)
      else                insights.push('前后半段发挥均衡，整体稳定性出色')
    }

    // ── 4. 各轮稳定性（4 组及以上，仅在表现显著时输出）
    if (endResults.length >= 4) {
      const totals = endResults.map(e => e.total)
      const range = Math.max(...totals) - Math.min(...totals)
      if (range <= 3)      insights.push(`各轮成绩最大相差仅 ${range} 环，一致性相当优秀`)
      else if (range >= 10) insights.push(`各轮成绩最大相差 ${range} 环，发挥波动较大，可针对性加强稳定性`)
    }

    // ── 5. 最佳轮次（always）
    insights.push(`第 ${best.endNum} 轮发挥最佳，打出 ${best.total} 环`)

    // ── 6. 完美一组（conditional）
    const perfectEndCount = endResults.filter(e => e.arrows.every(a => a === 'X' || a === '10')).length
    if (perfectEndCount === 1) insights.push('本次打出一组完美成绩，所有箭矢命中 X/10 环！')
    else if (perfectEndCount > 1) insights.push(`本次打出 ${perfectEndCount} 组完美成绩，状态绝佳！`)

    // ── 7. 淘汰赛局数统计（conditional：仅模拟淘汰赛）
    if (record.mode === '模拟淘汰赛') {
      const setsWon  = endResults.filter(e => e.setResult === 'win').length
      const setsDraw = endResults.filter(e => e.setResult === 'draw').length
      const setsLost = endResults.filter(e => e.setResult === 'lose').length
      insights.push(`本场共 ${endResults.length} 局：${setsWon} 胜 ${setsDraw} 平 ${setsLost} 负`)
    }

    this._bestEnd = best

    this.setData({
      record, xTenCount, xTenPct,
      arrowDisplay, insights,
      noteInput: record.note || '',
    })
  },

  startEditNote() { this.setData({ editingNote: true }) },
  onNoteChange(e) { this.setData({ noteInput: e.detail.value }) },

  saveNote() {
    const { noteInput, record } = this.data
    const updated = { ...record, note: noteInput.trim() }

    const history = wx.getStorageSync('training_history') || []
    const idx = history.findIndex(r => r.id === updated.id)
    if (idx >= 0) {
      history[idx] = updated
      wx.setStorageSync('training_history', history)
    }
    getApp().globalData.currentRecord = updated
    this.setData({ record: updated, editingNote: false })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  cancelEdit() {
    this.setData({ editingNote: false, noteInput: this.data.record.note || '' })
  },

  addMedia() {
    wx.showToast({ title: '照片功能开发中', icon: 'none' })
  },

  goBack() { wx.navigateBack() },

  // ── 分享卡片 ────────────────────────────────────
  async openShare() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成中…', mask: true })
    try {
      const path = await this._renderShareCanvas()
      this.setData({ shareImagePath: path, showShare: true, sharing: false })
    } catch (e) {
      console.error('share render fail', e)
      wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      this.setData({ sharing: false })
    } finally {
      wx.hideLoading()
    }
  },

  dismissShare() {
    this.setData({ showShare: false })
  },

  async saveToAlbum() {
    const filePath = this.data.shareImagePath
    if (!filePath) return
    try {
      await wx.saveImageToPhotosAlbum({ filePath })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
      this._hideShareTimer = setTimeout(() => this.setData({ showShare: false }), 800)
    } catch (e) {
      const msg = (e && e.errMsg) || ''
      if (msg.indexOf('auth deny') >= 0 || msg.indexOf('authorize') >= 0 || msg.indexOf('authSetting') >= 0) {
        wx.showModal({
          title: '需要相册权限',
          content: '保存图片需要授权访问相册，是否前往设置？',
          confirmText: '去授权',
          success: r => { if (r.confirm) wx.openSetting() },
        })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }
  },

  _renderShareCanvas() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query.select('#shareCanvas').fields({ node: true, size: true }).exec(res => {
        if (!res || !res[0] || !res[0].node) return reject(new Error('canvas not found'))
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio)
          || (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio)
          || 2
        const W = 750, H = 1334
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.scale(dpr, dpr)

        const r = this.data.record
        const insights = this.data.insights || []
        const best = this._bestEnd || { arrows: [], total: 0, endNum: 0 }
        const maxScore = (r.totalEnds || 0) * (r.arrowsPerEnd || 0) * 10

        // 背景渐变
        const bg = ctx.createLinearGradient(0, 0, W, H)
        bg.addColorStop(0, '#0F1F5C')
        bg.addColorStop(0.55, '#1E3A8A')
        bg.addColorStop(1, '#2563EB')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, W, H)

        // 同心环装饰（右上）
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 2
        for (let i = 0; i < 6; i++) {
          ctx.beginPath()
          ctx.arc(W - 60, 60, 60 + i * 70, 0, Math.PI * 2)
          ctx.stroke()
        }

        // 顶部：箭证 logo + 日期
        ctx.textBaseline = 'top'
        ctx.fillStyle = '#FF6B35'
        ctx.font = '900 40px PingFang SC, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('箭证', 56, 56)

        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.font = '24px PingFang SC, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(r.dateStr || '', W - 56, 64)

        // Hero：总环值
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.font = '26px PingFang SC, sans-serif'
        ctx.fillText('本次训练', W / 2, 180)

        ctx.fillStyle = '#fff'
        ctx.font = '900 180px PingFang SC, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(r.totalScore || 0), W / 2, 320)

        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.font = '30px PingFang SC, sans-serif'
        ctx.textBaseline = 'top'
        ctx.fillText(`/ ${maxScore} 环`, W / 2, 430)

        // 芯片：弓种 · 距离 · 轮次
        ctx.font = '24px PingFang SC, sans-serif'
        const chips = [
          r.bowType || '',
          r.distance || '',
          `${r.totalEnds || 0}轮 ${r.totalArrows || 0}支`,
        ].filter(Boolean)
        const padX = 28, gap = 16
        const chipWidths = chips.map(c => Math.ceil(ctx.measureText(c).width) + padX * 2)
        const chipsTotal = chipWidths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1)
        let cx = (W - chipsTotal) / 2
        const chipY = 500, chipH = 56
        chips.forEach((c, i) => {
          const cw = chipWidths[i]
          ctx.fillStyle = 'rgba(255,255,255,0.12)'
          this._roundRect(ctx, cx, chipY, cw, chipH, chipH / 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.textBaseline = 'middle'
          ctx.fillText(c, cx + cw / 2, chipY + chipH / 2 + 2)
          ctx.textBaseline = 'top'
          cx += cw + gap
        })

        // 最佳一轮
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '700 32px PingFang SC, sans-serif'
        ctx.fillText(`🏆 最佳第${best.endNum}轮  ${best.total}环`, 56, 620)

        // 箭支圆环
        const arrowCount = best.arrows.length || 1
        const arrowSize = Math.min(86, (W - 112 - (arrowCount - 1) * 16) / arrowCount)
        const arrowsWidth = arrowCount * arrowSize + (arrowCount - 1) * 16
        let ax = (W - arrowsWidth) / 2
        const ay = 700
        best.arrows.forEach(a => {
          const c = SLOT_COLORS[a] || { bg: '#E8ECF2', text: '#333' }
          ctx.fillStyle = c.bg
          ctx.beginPath()
          ctx.arc(ax + arrowSize / 2, ay + arrowSize / 2, arrowSize / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = c.text
          ctx.font = '900 32px PingFang SC, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(a, ax + arrowSize / 2, ay + arrowSize / 2 + 2)
          ax += arrowSize + 16
        })

        // 分隔线
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(56, 850, W - 112, 1)

        // 训练亮点
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '700 32px PingFang SC, sans-serif'
        ctx.fillText('训练亮点', 56, 890)

        let iy = 960
        const lineH = 38
        insights.slice(0, 3).forEach(text => {
          ctx.fillStyle = '#FF6B35'
          ctx.beginPath()
          ctx.arc(72, iy + 16, 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.font = '26px PingFang SC, sans-serif'
          const lines = this._wrapText(ctx, text, W - 56 - 100, 28)
          lines.forEach((ln, li) => ctx.fillText(ln, 100, iy + li * lineH))
          iy += lines.length * lineH + 22
        })

        // 底部品牌
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.font = '22px PingFang SC, sans-serif'
        ctx.fillText('箭证 · 用数据陪你练好每一支箭', W / 2, H - 80)

        // 输出图片
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvas,
            success: r => resolve(r.tempFilePath),
            fail: reject,
          })
        }, 30)
      })
    })
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  },

  _wrapText(ctx, text, maxWidth, fontSize) {
    const chars = [...String(text)]
    const lines = []
    let line = ''
    for (const ch of chars) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  },
})
