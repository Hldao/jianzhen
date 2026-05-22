const SCORE_VAL = s => s === 'X' ? 10 : s === 'M' ? 0 : parseInt(s)

// 精彩时刻：完美一组后等待继续的回调
let _pendingContinue = null
// 淘汰赛局结果确认后等待继续的回调
let _pendingElimResult = null

function calcOpponentLevel(history, distance, bowLabel) {
  const relevant = history
    .filter(r => r.endResults && r.distance === distance && r.bowType === bowLabel)
    .flatMap(r => r.endResults.filter(e => e.arrows && e.arrows.length === 3))
  if (relevant.length < 6) return { mean: 21, std: 3, hasHistory: false }
  const scores = relevant.map(e => e.total)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length
  return { mean: Math.round(mean * 10) / 10, std: Math.round(Math.max(1.5, Math.sqrt(variance)) * 10) / 10, hasHistory: true }
}

function randNormal(mean, std) {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.round(Math.min(30, Math.max(0, mean + z * std)))
}

// WA 标准 122cm 靶纸：X/10/9 黄  ·  8/7 红  ·  6/5 蓝  ·  4/3 黑  ·  2/1 白
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

function fmtSecs(s) {
  if (s <= 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m + ':' + (sec < 10 ? '0' + sec : sec)
}

function fmtTimeLabel(s) {
  if (s === 0) return '无限制'
  if (s < 60) return s + '秒'
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? m + '分钟' : m + '分' + rem + '秒'
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navTop: 0,

    // step: 0=设置  1=热身  2=SPT  3=记分  4=中场  5=结果
    step: 0,

    // ── 训练参数 ──────────────────────────────
    bowType: 'recurve',
    bowTypes: [
      { value: 'recurve',  label: '反曲弓' },
      { value: 'compound', label: '复合弓' },
      { value: 'barebow',  label: '传统弓' },
      { value: 'longbow',  label: '光弓' },
    ],
    distance: '70m',
    distances: ['10m', '18m', '30m', '50m', '70m'],
    targetSize: '122cm',
    targetSizes: ['40cm', '60cm', '80全', '80半', '122cm'],
    targetSizeHint: '',
    mode: 'ranking',     // ranking | elimination | custom
    showCustom: false,
    customEnds: 6,
    customArrowsPerEnd: 6,
    customTimeLimit: 180,
    customTimeLimitLabel: '3分钟',

    // ── 赛前准备 ──────────────────────────────
    warmupDone: false,
    sptDone: false,
    releaseDone: false,

    // ── 撒放练习计时器 ────────────────────────
    releaseSecs: 300,
    releasePct: 100,
    releaseDisplay: '5:00',
    releaseState: 'normal',
    releaseRunning: false,

    // ── 热身 ──────────────────────────────────
    warmupItems: [
      { id: 0, text: '肩部绕环 × 20圈', done: false },
      { id: 1, text: '弹力带开肩 × 15次', done: false },
      { id: 2, text: '颈部侧伸 × 10次', done: false },
      { id: 3, text: '腰背拉伸 1分钟', done: false },
      { id: 4, text: '手腕绕环 × 20圈', done: false },
    ],

    // ── SPT 空拉 ──────────────────────────────
    sptCount: 0,
    sptTarget: 6,

    // ── 记分 ──────────────────────────────────
    arrowsPerEnd: 6,
    totalEnds: 12,
    endUnit: '组',       // '组' 排名赛/自定义  '局' 模拟淘汰赛
    ends: [],
    currentEnd: 0,
    totalScore: 0,
    halfScore: 0,
    endTotal: 0,
    isEndDone: false,
    endSlots: [],
    endResults: [],

    scoreButtons: [
      { label: 'M',  value: 'M'  },
      { label: '1',  value: '1'  }, { label: '2',  value: '2'  }, { label: '3',  value: '3'  },
      { label: '4',  value: '4'  }, { label: '5',  value: '5'  }, { label: '6',  value: '6'  },
      { label: '7',  value: '7'  }, { label: '8',  value: '8'  }, { label: '9',  value: '9'  },
      { label: '10', value: '10' }, { label: 'X',  value: 'X'  },
    ],

    // ── 结果备注 ──────────────────────────────────
    note: '',

    // ── 精彩时刻弹层 ──────────────────────────────
    showMoment: false,
    momentType: '',          // 'perfect' | 'golden' | 'pb'
    momentIsFirstPerfect: false,
    momentIsFirstGolden: false,
    momentArrows: [],        // 完美一组时展示
    momentPBDiff: 0,         // 个人最佳时超出历史多少环
    isPB: false,
    momentCardScore: '',     // 迷你分享卡大字
    momentCardUnit: '',      // 迷你分享卡单位
    momentCardMeta: '',      // 迷你分享卡副文本

    // ── 计时器 ──────────────────────────────────
    timerTotal: 0,
    timerSecs: 0,
    timerPct: 100,
    timerDisplay: '0:00',
    timerState: 'normal',   // 'normal' | 'warning' | 'critical'
    timerRunning: false,
    timerElimArrow: false,  // true = 每箭30秒（模拟淘汰赛）
    timerIsArrow: false,    // 显示"本箭"标签

    // ── 模拟淘汰赛虚拟对手 ──────────────────────────
    elimDifficulty: 'normal',  // 'easy' | 'normal' | 'hard'
    elimOpponentMean: 21,
    elimOpponentStd: 3,
    elimMyPts: 0,
    elimOppPts: 0,
    showElimResult: false,
    elimLastSet: null,
    elimMatchOver: false,
    elimMatchWon: null,
  },

  onLoad() {
    const app = getApp()
    const sh = app.globalData.statusBarHeight
    const nh = app.globalData.navBarHeight
    this.setData({ statusBarHeight: sh, navBarHeight: nh, navTop: sh + nh })

    const last = wx.getStorageSync('training_last_settings')
    if (last) {
      const hints = {
        '40cm':  '全10环 · 室内18m',
        '60cm':  '室内25m / 室外近距离',
        '80全':  '全10环（1-10+X）· 室外30m / 50m',
        '80半':  '内5环（6-10+X）· 室内18m / 室外30m精准训练',
        '122cm': '全10环 · 室外50m / 70m',
      }
      this.setData({
        bowType:            last.bowType           || 'recurve',
        distance:           last.distance          || '70m',
        targetSize:         last.targetSize        || '122cm',
        targetSizeHint:     hints[last.targetSize] || '',
        mode:               last.mode              || 'ranking',
        showCustom:         last.mode === 'custom',
        customEnds:         last.customEnds        || 6,
        customArrowsPerEnd: last.customArrowsPerEnd|| 6,
        customTimeLimit:    last.customTimeLimit   || 180,
        customTimeLimitLabel: fmtTimeLabel(last.customTimeLimit || 180),
        elimDifficulty:     last.elimDifficulty    || 'normal',
      })
    }
  },

  // 从后台回到前台：用时间戳重新算剩余秒数，补偿后台耗时
  onShow() {
    if (this.data.timerRunning) {
      const target = this._timerTarget
        || (wx.getStorageSync('training_timer') || {}).targetTime
      if (target) {
        this._timerTarget = target
        const remaining = Math.max(0, Math.round((target - Date.now()) / 1000))
        if (remaining === 0) {
          this._clearTimer()
          wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
        } else {
          this.setData({ timerSecs: remaining })
          this._startTimer()
        }
      }
    }
    if (this.data.releaseRunning) {
      const target = this._releaseTarget
        || (wx.getStorageSync('release_timer') || {}).targetTime
      if (target) {
        this._releaseTarget = target
        const remaining = Math.max(0, Math.round((target - Date.now()) / 1000))
        if (remaining === 0) {
          this._clearReleaseTimer()
          wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
        } else {
          this.setData({ releaseSecs: remaining })
          this._startReleaseTimer()
        }
      }
    }
  },

  // 进入后台：停掉 JS interval（后台不执行），但保留 Storage 供 onShow 恢复
  onHide() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    if (this._releaseTimer) { clearInterval(this._releaseTimer); this._releaseTimer = null }
  },

  onUnload() {
    this._clearTimer()
    this._clearReleaseTimer()
  },

  // ── 参数设置 ────────────────────────────────────────────────────
  setBowType(e)  { this.setData({ bowType: e.currentTarget.dataset.value }) },
  setDistance(e) { this.setData({ distance: e.currentTarget.dataset.val }) },

  setTargetSize(e) {
    const targetSize = e.currentTarget.dataset.val
    const hints = {
      '40cm':  '全10环 · 室内18m',
      '60cm':  '室内25m / 室外近距离',
      '80全':  '全10环（1-10+X）· 室外30m / 50m',
      '80半':  '内5环（6-10+X）· 室内18m / 室外30m精准训练',
      '122cm': '全10环 · 室外50m / 70m',
    }
    this.setData({ targetSize, targetSizeHint: hints[targetSize] || '' })
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode, showCustom: mode === 'custom' })
  },

  changeCustomEnds(e) {
    const val = this.data.customEnds + parseInt(e.currentTarget.dataset.delta)
    this.setData({ customEnds: Math.max(1, Math.min(20, val)) })
  },

  changeCustomArrows(e) {
    const val = this.data.customArrowsPerEnd + parseInt(e.currentTarget.dataset.delta)
    this.setData({ customArrowsPerEnd: Math.max(1, Math.min(12, val)) })
  },

  changeCustomTime(e) {
    const val = this.data.customTimeLimit + parseInt(e.currentTarget.dataset.delta)
    const clamped = Math.max(0, Math.min(600, val))
    this.setData({ customTimeLimit: clamped, customTimeLimitLabel: fmtTimeLabel(clamped) })
  },

  goWarmup()   { this.setData({ step: 1 }) },
  goSpt()      { this.setData({ step: 2 }) },
  goRelease()  {
    this._clearReleaseTimer()
    this.setData({
      step: 6,
      releaseSecs: 300, releasePct: 100,
      releaseDisplay: '5:00', releaseState: 'normal', releaseRunning: false,
    })
  },

  startTraining() {
    const { bowType, distance, targetSize, mode, customEnds, customArrowsPerEnd, customTimeLimit, elimDifficulty } = this.data
    wx.setStorageSync('training_last_settings', { bowType, distance, targetSize, mode, customEnds, customArrowsPerEnd, customTimeLimit, elimDifficulty })
    const totalEnds    = mode === 'ranking' ? 12 : mode === 'elimination' ? 5 : customEnds
    const arrowsPerEnd = mode === 'ranking' ? 6  : mode === 'elimination' ? 3 : customArrowsPerEnd
    const endUnit      = mode === 'elimination' ? '局' : '组'

    let timerTotal = 0
    let timerElimArrow = false
    if (mode === 'ranking') {
      timerTotal = 180
    } else if (mode === 'elimination') {
      timerTotal = 0
      timerElimArrow = false
    } else {
      timerTotal = customTimeLimit
    }

    let elimInit = {}
    if (mode === 'elimination') {
      const BOW_LABEL = { recurve: '反曲弓', compound: '复合弓', barebow: '传统弓', longbow: '光弓' }
      const bowLabel = BOW_LABEL[this.data.bowType] || this.data.bowType
      const history = wx.getStorageSync('training_history') || []
      const oppLevel = calcOpponentLevel(history, this.data.distance, bowLabel)
      const DIFF_OFFSET = { easy: -3, normal: 0, hard: 3 }
      const offset = DIFF_OFFSET[this.data.elimDifficulty] || 0
      elimInit = {
        elimOpponentMean: Math.max(3, oppLevel.mean + offset),
        elimOpponentStd: oppLevel.std,
        elimMyPts: 0, elimOppPts: 0,
        showElimResult: false, elimLastSet: null,
        elimMatchOver: false, elimMatchWon: null,
      }
    }
    this._trainingStart = Date.now()
    const ends = Array.from({ length: totalEnds }, () => [])
    this.setData({
      step: 3, totalEnds, arrowsPerEnd, endUnit,
      ends, currentEnd: 0, totalScore: 0, halfScore: 0,
      endTotal: 0, isEndDone: false, endResults: [],
      endSlots: this._buildSlots([], arrowsPerEnd),
      timerTotal, timerSecs: timerTotal,
      timerPct: 100, timerDisplay: fmtSecs(timerTotal),
      timerState: 'normal', timerRunning: false, timerElimArrow,
      ...elimInit,
    })
  },

  // ── 热身 ────────────────────────────────────────────────────────
  toggleWarmup(e) {
    const items = [...this.data.warmupItems]
    items[e.currentTarget.dataset.index].done = !items[e.currentTarget.dataset.index].done
    this.setData({ warmupItems: items })
  },
  finishWarmup() { this.setData({ step: 0, warmupDone: true }) },
  skipWarmup()   { this.setData({ step: 0 }) },

  // ── SPT ─────────────────────────────────────────────────────────
  recordSpt() { this.setData({ sptCount: this.data.sptCount + 1 }) },
  finishSpt()  { this.setData({ step: 0, sptDone: true, sptCount: 0 }) },
  skipSpt()    { this.setData({ step: 0, sptCount: 0 }) },

  // ── 撒放练习 ──────────────────────────────────────────────────
  toggleReleaseTimer() {
    if (this.data.releaseRunning) {
      this._clearReleaseTimer()
    } else if (this.data.releaseSecs > 0) {
      this._startReleaseTimer()
    }
  },

  finishRelease() { this._clearReleaseTimer(); this.setData({ step: 0, releaseDone: true }) },
  skipRelease()   { this._clearReleaseTimer(); this.setData({ step: 0 }) },

  _startReleaseTimer() {
    if (this._releaseTimer) { clearInterval(this._releaseTimer); this._releaseTimer = null }
    this._releaseTarget = Date.now() + this.data.releaseSecs * 1000
    wx.setStorageSync('release_timer', { targetTime: this._releaseTarget })
    this._releaseTimer = setInterval(() => {
      const s   = Math.max(0, Math.round((this._releaseTarget - Date.now()) / 1000))
      const pct = Math.round(s / 300 * 100)
      const st  = s <= 15 ? 'critical' : s <= 60 ? 'warning' : 'normal'
      this.setData({ releaseSecs: s, releasePct: pct, releaseDisplay: fmtSecs(s), releaseState: st, releaseRunning: s > 0 })
      if (s === 0) {
        this._clearReleaseTimer()
        wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
      }
    }, 500)
    this.setData({ releaseRunning: true })
  },

  _clearReleaseTimer() {
    if (this._releaseTimer) { clearInterval(this._releaseTimer); this._releaseTimer = null }
    this._releaseTarget = null
    wx.removeStorageSync('release_timer')
    this.setData({ releaseRunning: false })
  },

  // ── 记分 ────────────────────────────────────────────────────────
  recordArrow(e) {
    const { ends, currentEnd, arrowsPerEnd, timerElimArrow } = this.data
    const arrows = [...ends[currentEnd]]
    if (arrows.length >= arrowsPerEnd) return
    arrows.push(e.currentTarget.dataset.value)
    this._applyArrows(arrows)
    // 模拟淘汰赛：每箭后重置倒计时，未满则开始下一箭
    if (timerElimArrow) {
      this._resetTimer()
      if (arrows.length < arrowsPerEnd) this._startTimer()
    }
  },

  deleteLastArrow() {
    const { ends, currentEnd } = this.data
    const arrows = [...ends[currentEnd]]
    if (!arrows.length) return
    arrows.pop()
    this._applyArrows(arrows)
  },

  _applyArrows(arrows) {
    const { ends, currentEnd, arrowsPerEnd, timerElimArrow } = this.data
    const newEnds = [...ends]
    newEnds[currentEnd] = arrows
    const endTotal   = arrows.reduce((s, a) => s + SCORE_VAL(a), 0)
    const totalScore = newEnds.flat().reduce((s, a) => s + SCORE_VAL(a), 0)
    const isEndDone  = arrows.length === arrowsPerEnd
    this.setData({
      ends: newEnds, endTotal, totalScore, isEndDone,
      endSlots: this._buildSlots(arrows, arrowsPerEnd),
    })
    // 排名赛/自定义：完成一组自动暂停计时
    if (isEndDone && !timerElimArrow) this._clearTimer()
  },

  _buildSlots(arrows, n) {
    const count = n || this.data.arrowsPerEnd
    return Array.from({ length: count }, (_, i) => {
      const s = arrows[i]
      if (s !== undefined) {
        const c = SLOT_COLORS[s] || { bg: '#E8ECF2', text: '#333' }
        return { score: s, bg: c.bg, textColor: c.text, isCurrent: false }
      }
      return { score: '', bg: '#E8ECF2', textColor: '#94A3B8', isCurrent: i === arrows.length }
    })
  },

  nextEnd() {
    const { ends, currentEnd, totalEnds, mode, totalScore, endResults, arrowsPerEnd, timerElimArrow, distance, bowType, bowTypes } = this.data
    const arrows = ends[currentEnd]
    const newResults = [...endResults, {
      endNum: currentEnd + 1,
      arrows: [...arrows],
      total: arrows.reduce((s, a) => s + SCORE_VAL(a), 0),
    }]
    const next = currentEnd + 1

    const isPerfect    = arrows.length >= arrowsPerEnd && arrows.every(a => a === 'X' || a === '10')
    // 收黄：所有箭 ≥9 且至少一个 9（≠ 全 X/10），且非淘汰赛
    const isGoldenOnly = arrows.length >= arrowsPerEnd
      && !isPerfect
      && arrows.every(a => SCORE_VAL(a) >= 9)
      && mode !== 'elimination'

    // 成就：完美一组（任意模式 · 计入 achievement_perfect_end）
    let isFirstPerfect = false
    if (isPerfect) {
      const prev = wx.getStorageSync('achievement_perfect_end') || null
      isFirstPerfect = !prev
      wx.setStorageSync('achievement_perfect_end', {
        earnedAt: prev ? prev.earnedAt : Date.now(),
        count: prev ? (prev.count || 0) + 1 : 1,
      })
    }
    // 成就：收黄（非淘汰赛 · 计入 achievement_golden_end）
    let isFirstGolden = false
    if (isGoldenOnly) {
      const prev = wx.getStorageSync('achievement_golden_end') || null
      isFirstGolden = !prev
      wx.setStorageSync('achievement_golden_end', {
        earnedAt: prev ? prev.earnedAt : Date.now(),
        count: prev ? (prev.count || 0) + 1 : 1,
      })
    }

    if (isPerfect || isGoldenOnly) {
      this._clearTimer()
      const bowLabel = (bowTypes.find(b => b.value === bowType) || {}).label || bowType
      const d = new Date()
      const meta = `${distance} · ${bowLabel} · ${d.getMonth()+1}月${d.getDate()}日`
      const endScore = arrows.reduce((s, a) => s + SCORE_VAL(a), 0)
      this.setData({
        endResults: newResults,
        showMoment: true,
        momentType: isPerfect ? 'perfect' : 'golden',
        momentArrows: [...arrows],
        momentCardScore: isPerfect ? String(arrows.length) : String(endScore),
        momentCardUnit:  isPerfect ? '× X' : '环',
        momentCardMeta:  meta,
        momentIsFirstPerfect: isFirstPerfect,
        momentIsFirstGolden: isFirstGolden,
      })
      _pendingContinue = () => this._proceedNextEnd(next, newResults, mode, totalScore, totalEnds, arrowsPerEnd, timerElimArrow)
      return
    }
    this._proceedNextEnd(next, newResults, mode, totalScore, totalEnds, arrowsPerEnd, timerElimArrow)
  },

  _proceedNextEnd(next, newResults, mode, totalScore, totalEnds, arrowsPerEnd, timerElimArrow) {
    if (mode === 'ranking' && next === 6) {
      this._clearTimer()
      this.setData({ step: 4, halfScore: totalScore, endResults: newResults, currentEnd: next })
      return
    }

    if (mode === 'elimination') {
      const { elimOpponentMean, elimOpponentStd, elimMyPts, elimOppPts } = this.data
      const lastResult = newResults[newResults.length - 1]
      const myScore  = lastResult.total
      const oppScore = Math.round(Math.max(0, Math.min(arrowsPerEnd * 10, randNormal(elimOpponentMean, elimOpponentStd))))

      let myPtsGain = 0, oppPtsGain = 0
      if (myScore > oppScore)       { myPtsGain = 2 }
      else if (myScore === oppScore) { myPtsGain = 1; oppPtsGain = 1 }
      else                           { oppPtsGain = 2 }

      const newMyPts   = elimMyPts  + myPtsGain
      const newOppPts  = elimOppPts + oppPtsGain
      const setResult  = myScore > oppScore ? 'win' : myScore === oppScore ? 'draw' : 'lose'
      const setsPlayed = newResults.length
      const matchOver  = newMyPts >= 6 || newOppPts >= 6 || setsPlayed >= totalEnds

      let matchWon = null
      if (matchOver) {
        if (newMyPts > newOppPts) matchWon = true
        else if (newMyPts < newOppPts) matchWon = false
        else matchWon = Math.random() < 0.5  // 平局加射，50/50
      }

      // 在 endResults 中记录对手成绩，step 5 复盘时显示
      lastResult.oppScore  = oppScore
      lastResult.setResult = setResult

      this.setData({
        endResults: newResults,
        elimMyPts: newMyPts, elimOppPts: newOppPts,
        showElimResult: true,
        elimLastSet: { endNum: setsPlayed, myScore, oppScore, setResult, myPtsAfter: newMyPts, oppPtsAfter: newOppPts },
        elimMatchOver: matchOver,
        elimMatchWon: matchWon,
      })

      if (matchOver) {
        _pendingElimResult = () => this.setData({ step: 5, totalEnds: setsPlayed })
      } else {
        _pendingElimResult = () => this.setData({
          currentEnd: next, isEndDone: false, endTotal: 0,
          endSlots: this._buildSlots([], arrowsPerEnd),
        })
      }
      return
    }

    if (next >= totalEnds) {
      this._clearTimer()
      // 检测个人最佳
      const history = wx.getStorageSync('training_history') || []
      const histBest = history.length > 0 ? Math.max(...history.map(r => r.totalScore)) : 0
      const isPB = histBest > 0 && totalScore > histBest
      let pbExtra = {}
      if (isPB) {
        const { distance, bowType, bowTypes } = this.data
        const bowLabel = (bowTypes.find(b => b.value === bowType) || {}).label || bowType
        const d = new Date()
        pbExtra = {
          showMoment: true, momentType: 'pb',
          momentPBDiff: totalScore - histBest,
          momentCardScore: String(totalScore),
          momentCardUnit: '环',
          momentCardMeta: `${distance} · ${bowLabel} · ${d.getMonth()+1}月${d.getDate()}日`,
        }
      }
      this.setData({ step: 5, endResults: newResults, isPB, ...pbExtra })
      return
    }
    this.setData({
      currentEnd: next, isEndDone: false, endTotal: 0,
      endResults: newResults,
      endSlots: this._buildSlots([], arrowsPerEnd),
    })
    this._resetTimer()
    if (timerElimArrow) this._startTimer()
  },

  dismissMoment() {
    this.setData({ showMoment: false })
    if (_pendingContinue) {
      const fn = _pendingContinue
      _pendingContinue = null
      fn()
    }
  },

  changeElimDifficulty(e) {
    this.setData({ elimDifficulty: e.currentTarget.dataset.level })
  },

  dismissElimResult() {
    this.setData({ showElimResult: false })
    if (_pendingElimResult) {
      const fn = _pendingElimResult
      _pendingElimResult = null
      fn()
    }
  },

  saveMomentCard() {
    wx.showToast({ title: '分享功能开发中', icon: 'none', duration: 1500 })
    setTimeout(() => this.dismissMoment(), 1600)
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  finishTraining() {
    const {
      bowType, distance, targetSize, mode,
      totalScore, endResults, arrowsPerEnd, note,
    } = this.data
    const BOW = { recurve: '反曲弓', compound: '复合弓', barebow: '传统弓', longbow: '光弓' }
    const MODE = { ranking: '排名赛', elimination: '模拟淘汰赛', custom: '自定义' }
    const DAYS = ['日', '一', '二', '三', '四', '五', '六']
    const now = new Date()
    const totalArrows = endResults.reduce((s, e) => s + e.arrows.length, 0)
    const bestEnd = endResults.reduce((b, e) => e.total > (b ? b.total : -1) ? e : b, null)

    const record = {
      id: now.getTime(),
      ts: now.getTime(),   // 云端用 ts 字段存时间戳，与 id 保持一致
      dateStr: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${DAYS[now.getDay()]}`,
      timeStr: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      bowType: BOW[bowType] || bowType,
      distance,
      targetSize,
      mode: MODE[mode] || mode,
      totalScore,
      totalArrows,
      totalEnds: endResults.length,
      arrowsPerEnd,
      avgPerArrow: totalArrows > 0 ? Math.round(totalScore / totalArrows * 10) / 10 : 0,
      bestEndTotal: bestEnd ? bestEnd.total : 0,
      note: note.trim(),
      endResults,
      durationMin: this._trainingStart
        ? Math.max(1, Math.round((Date.now() - this._trainingStart) / 60000))
        : 0,
    }
    // 本地缓存写一份（离线可用）
    const history = wx.getStorageSync('training_history') || []
    history.unshift(record)
    wx.setStorageSync('training_history', history)

    // 同步到云端（异步，不阻塞导航）
    const api = require('../../utils/cloud')
    api.training.save(record).catch(e => console.error('云端同步失败', e))

    wx.navigateBack()
  },

  continueSecondHalf() {
    this.setData({
      step: 3, isEndDone: false, endTotal: 0,
      endSlots: this._buildSlots([], this.data.arrowsPerEnd),
    })
    this._resetTimer()
    if (this.data.timerElimArrow) this._startTimer()
  },

  tapTimer() {
    const { timerRunning, timerTotal, isEndDone, timerSecs, timerElimArrow } = this.data
    if (timerElimArrow || timerTotal === 0 || isEndDone || timerSecs === 0 || timerRunning) return
    this._startTimer()
  },

  goBack() {
    const { step } = this.data
    if (step === 0) { wx.navigateBack(); return }
    if (step === 1 || step === 2) { this.setData({ step: 0 }); return }
    if (step === 6) { this._clearReleaseTimer(); this.setData({ step: 0 }); return }
    wx.showModal({
      title: '退出训练', content: '当前训练记录将不保存，确认退出？',
      success: r => { if (r.confirm) { this._clearTimer(); wx.navigateBack() } },
    })
  },

  // ── 计时器（时间戳锚点法，后台恢复后自动补偿）──────────────────
  _startTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    if (this.data.timerTotal === 0) return
    // 记录目标结束的绝对时间戳，onShow 时用 Date.now() 差值算剩余
    this._timerTarget = Date.now() + this.data.timerSecs * 1000
    wx.setStorageSync('training_timer', {
      targetTime: this._timerTarget,
      timerTotal: this.data.timerTotal,
      timerElimArrow: this.data.timerElimArrow,
    })
    this._timer = setInterval(() => {
      const s   = Math.max(0, Math.round((this._timerTarget - Date.now()) / 1000))
      const pct = Math.round(s / this.data.timerTotal * 100)
      const st  = this._timerState(s, this.data.timerTotal)
      this.setData({ timerSecs: s, timerPct: pct, timerState: st, timerDisplay: fmtSecs(s) })
      if (s === 0) {
        this._clearTimer()
        wx.vibrateShort && wx.vibrateShort({ type: 'heavy' })
      }
    }, 500)
    this.setData({ timerRunning: true })
  },

  _clearTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    this._timerTarget = null
    wx.removeStorageSync('training_timer')
    this.setData({ timerRunning: false })
  },

  _resetTimer() {
    this._clearTimer()
    const total = this.data.timerTotal
    this.setData({
      timerSecs: total, timerPct: 100,
      timerDisplay: fmtSecs(total), timerState: 'normal',
    })
  },

  _timerState(s, total) {
    if (total === 0) return 'normal'
    const warnAt = total >= 60 ? 45 : Math.floor(total / 2)
    const critAt = total >= 60 ? 15 : Math.max(5, Math.floor(total / 5))
    if (s <= critAt) return 'critical'
    if (s <= warnAt) return 'warning'
    return 'normal'
  },
})
