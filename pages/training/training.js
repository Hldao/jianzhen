const { handleErr } = require('../../utils/error')
const sfx = require('../../utils/sfx')
const {
  SCORE_VAL,
  SLOT_COLORS,
  calcOpponentLevel,
  randNormal,
  fmtSecs,
  fmtTimeLabel,
} = require('../../utils/training-helper')

// 精彩时刻：完美一组后等待继续的回调
let _pendingContinue = null
// 淘汰赛局结果确认后等待继续的回调
let _pendingElimResult = null

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
    distance: '18m',
    distances: ['10m', '18m', '30m', '50m', '70m'],
    targetSize: '40cm',
    targetSizes: ['40cm', '60cm', '80全', '80半', '122cm'],
    targetSizeHint: '全10环 · 室内18m',
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
    elimOpponentBest: 24,   // 决胜局用「最强的自己」
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
    sfx.preload()  // 预热提示音，倒计时催促首播无延迟

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
    this._checkRecover()  // 有未完成训练存档则弹窗问是否恢复
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
          sfx.end()
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
          sfx.end()
          wx.vibrateLong && wx.vibrateLong()
        } else {
          this.setData({ releaseSecs: remaining })
          this._startReleaseTimer()
        }
      }
    }
  },

  // 进入后台：停掉 JS interval（后台不执行），但保留 Storage 供 onShow 恢复。
  // 切屏/接电话一定先触发 onHide，这里把进行中成绩落盘，防系统随后回收页面丢分。
  onHide() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    if (this._releaseTimer) { clearInterval(this._releaseTimer); this._releaseTimer = null }
    this._snapshotActive()
  },

  onUnload() {
    this._clearTimer()
    this._clearReleaseTimer()
    if (this._dismissMomentTimer) clearTimeout(this._dismissMomentTimer)
    sfx.dispose()  // 释放 InnerAudioContext，避免离页后泄漏
  },

  // ── 进行中训练自动存档 / 恢复（防切屏·接电话被系统回收丢成绩）────────
  // 只存「记分及之后」(step 3/4/5) 的核心状态；计时器/弹层等瞬态不存，恢复时重算。
  ACTIVE_KEY: 'training_active',
  ACTIVE_TTL: 24 * 3600 * 1000,  // 超过 24h 的残档不再提示恢复

  _snapshotActive() {
    const d = this.data
    if (d.step < 3 || d.step > 5) return
    try {
      wx.setStorageSync(this.ACTIVE_KEY, {
        v: 1, step: d.step,
        bowType: d.bowType, distance: d.distance, targetSize: d.targetSize, mode: d.mode,
        customEnds: d.customEnds, customArrowsPerEnd: d.customArrowsPerEnd,
        customTimeLimit: d.customTimeLimit, elimDifficulty: d.elimDifficulty,
        totalEnds: d.totalEnds, arrowsPerEnd: d.arrowsPerEnd, endUnit: d.endUnit,
        ends: d.ends, currentEnd: d.currentEnd, totalScore: d.totalScore,
        halfScore: d.halfScore, endResults: d.endResults,
        timerTotal: d.timerTotal, timerElimArrow: d.timerElimArrow,
        elimOpponentMean: d.elimOpponentMean, elimOpponentBest: d.elimOpponentBest,
        elimOpponentStd: d.elimOpponentStd,
        elimMyPts: d.elimMyPts, elimOppPts: d.elimOppPts,
        elimMatchOver: d.elimMatchOver, elimMatchWon: d.elimMatchWon,
        note: d.note, trainingStart: this._trainingStart || null,
        savedAt: Date.now(),
      })
    } catch (e) { handleErr('training.snapshot', e) }
  },

  _clearActive() {
    try { wx.removeStorageSync(this.ACTIVE_KEY) } catch (e) {}
  },

  // onLoad 调用：有未完成存档则弹窗问是否恢复
  _checkRecover() {
    let a = null
    try { a = wx.getStorageSync(this.ACTIVE_KEY) } catch (e) { return }
    if (!a || !a.ends || a.step < 3 || a.step > 5) return
    if (!a.savedAt || Date.now() - a.savedAt > this.ACTIVE_TTL) { this._clearActive(); return }
    const recorded = (a.endResults || []).length
    wx.showModal({
      title: '继续上次训练？',
      content: `检测到一组未完成的训练（已记录 ${recorded} ${a.endUnit || '组'}），是否恢复继续？`,
      confirmText: '继续', cancelText: '放弃',
      success: r => {
        if (r.confirm) this._restoreActive(a)
        else this._clearActive()
      },
    })
  },

  _restoreActive(a) {
    this._trainingStart = a.trainingStart || Date.now()
    // 清掉残留的计时器锚点，避免 onShow 拿旧 targetTime 误判归零
    wx.removeStorageSync('training_timer')
    wx.removeStorageSync('release_timer')

    const arrowsPerEnd = a.arrowsPerEnd
    const ends = Array.isArray(a.ends) ? a.ends.map(e => Array.isArray(e) ? e : []) : []
    let step = a.step
    // 归一化 currentEnd：一致态下 endResults.length === currentEnd；
    // 若被「精彩时刻/淘汰赛弹层」中途回收，endResults 会多一条 → 据此自动前进一组，
    // 既不丢已完成的那组，也不会重复记分 / 重复计成就。
    let currentEnd = step === 3 ? (a.endResults || []).length : a.currentEnd
    if (step === 3 && (currentEnd >= a.totalEnds || a.elimMatchOver)) step = 5
    if (currentEnd >= ends.length) currentEnd = Math.max(0, ends.length - 1)
    const cur = ends[currentEnd] || []
    const totalScore = ends.flat().reduce((s, x) => s + SCORE_VAL(x), 0)

    this.setData({
      step,
      bowType: a.bowType, distance: a.distance, targetSize: a.targetSize, mode: a.mode,
      customEnds: a.customEnds, customArrowsPerEnd: a.customArrowsPerEnd,
      customTimeLimit: a.customTimeLimit,
      customTimeLimitLabel: fmtTimeLabel(a.customTimeLimit || 180),
      elimDifficulty: a.elimDifficulty,
      totalEnds: a.totalEnds, arrowsPerEnd, endUnit: a.endUnit,
      ends, currentEnd, totalScore, halfScore: a.halfScore || 0,
      endTotal: cur.reduce((s, x) => s + SCORE_VAL(x), 0),
      isEndDone: cur.length === arrowsPerEnd,
      endSlots: this._buildSlots(cur, arrowsPerEnd),
      endResults: a.endResults || [],
      // 计时器恢复为暂停态：不猜剩余时间，由用户手动点开始
      timerTotal: a.timerTotal || 0, timerSecs: a.timerTotal || 0,
      timerPct: 100, timerDisplay: fmtSecs(a.timerTotal || 0),
      timerState: 'normal', timerRunning: false, timerElimArrow: !!a.timerElimArrow,
      elimOpponentMean: a.elimOpponentMean || 21, elimOpponentBest: a.elimOpponentBest || 24,
      elimOpponentStd: a.elimOpponentStd || 3,
      elimMyPts: a.elimMyPts || 0, elimOppPts: a.elimOppPts || 0,
      elimMatchOver: !!a.elimMatchOver, elimMatchWon: a.elimMatchWon,
      showElimResult: false, elimLastSet: null,
      showMoment: false, momentType: '', isPB: false,
      note: a.note || '',
    })
    // 恢复后立即重存一份，刷新 savedAt
    this._snapshotActive()
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
      // 表现偏置（每箭环·×3 换算成一组）：normal 让对手略高于你的平均，贴近「更好的自己」；
      // easy 让分、hard 挑战。决胜局另切到「最强的自己」(best)。
      const BIAS_PER_ARROW = { easy: -0.5, normal: 0.4, hard: 1.1 }
      const bias = (BIAS_PER_ARROW[this.data.elimDifficulty] ?? 0.4) * 3
      const clamp = v => Math.max(3, Math.min(30, Math.round(v * 10) / 10))
      elimInit = {
        elimOpponentMean: clamp(oppLevel.mean + bias),
        elimOpponentBest: clamp(oppLevel.best + bias),  // 决胜局用
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
    this._snapshotActive()  // 开局即存档，后续每步增量更新
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
    this._lastTickSec = null
    this._releaseTimer = setInterval(() => {
      const s   = Math.max(0, Math.round((this._releaseTarget - Date.now()) / 1000))
      const pct = Math.round(s / 300 * 100)
      const st  = s <= 15 ? 'critical' : s <= 60 ? 'warning' : 'normal'
      this.setData({ releaseSecs: s, releasePct: pct, releaseDisplay: fmtSecs(s), releaseState: st, releaseRunning: s > 0 })
      this._tickSound(s)
      if (s === 0) {
        this._clearReleaseTimer()
        wx.vibrateLong && wx.vibrateLong()
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
    this._snapshotActive()  // 每记/删一支箭都落盘
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
    this._snapshotActive()
  },

  _proceedNextEnd(next, newResults, mode, totalScore, totalEnds, arrowsPerEnd, timerElimArrow) {
    if (mode === 'ranking' && next === 6) {
      this._clearTimer()
      this.setData({ step: 4, halfScore: totalScore, endResults: newResults, currentEnd: next })
      return
    }

    if (mode === 'elimination') {
      const { elimOpponentMean, elimOpponentBest, elimOpponentStd, elimMyPts, elimOppPts } = this.data
      const lastResult = newResults[newResults.length - 1]
      const myScore  = lastResult.total
      // 决胜局（任一方已 5 分、本局可终结；或打到最后一局）→ 对手切到「最强的自己」
      const isDecider = elimMyPts >= 5 || elimOppPts >= 5 || newResults.length >= totalEnds
      const oppMean  = isDecider ? (elimOpponentBest || elimOpponentMean) : elimOpponentMean
      const oppScore = Math.round(Math.max(0, Math.min(arrowsPerEnd * 10, randNormal(oppMean, elimOpponentStd))))

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
    this._snapshotActive()
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
    this._snapshotActive()
  },

  // 渲染「精彩时刻」分享图 → 保存到相册
  async saveMomentCard() {
    if (this._renderingMoment) return
    this._renderingMoment = true
    wx.showLoading({ title: '生成中…', mask: true })
    try {
      const filePath = await this._renderMomentCanvas()
      await wx.saveImageToPhotosAlbum({ filePath })
      wx.hideLoading()
      wx.showToast({ title: '已保存到相册', icon: 'success' })
      this._dismissMomentTimer = setTimeout(() => this.dismissMoment(), 1200)
    } catch (e) {
      wx.hideLoading()
      const msg = (e && e.errMsg) || ''
      if (msg.indexOf('auth deny') >= 0 || msg.indexOf('authorize') >= 0 || msg.indexOf('authSetting') >= 0) {
        wx.showModal({
          title: '需要相册权限',
          content: '保存图片需要授权访问相册，是否前往设置？',
          confirmText: '去授权',
          success: r => { if (r.confirm) wx.openSetting() },
        })
      } else {
        handleErr('training.saveMomentCard', e)
        wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      }
    } finally {
      this._renderingMoment = false
    }
  },

  _renderMomentCanvas() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query.select('#momentCanvas').fields({ node: true, size: true }).exec(res => {
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

        const {
          momentType, momentArrows = [],
          momentCardScore, momentCardUnit, momentCardMeta,
          momentIsFirstPerfect, momentIsFirstGolden,
        } = this.data

        // 类型 → 配色 + 文案
        const themes = {
          perfect: {
            bgFrom: '#0F1F5C', bgMid: '#1E3A8A', bgTo: '#2563EB',
            accent: '#F5C518', badge: '完美一组', emoji: '✦',
          },
          golden:  {
            bgFrom: '#7C2D12', bgMid: '#B45309', bgTo: '#F59E0B',
            accent: '#FDE68A', badge: '收黄一组', emoji: '⭐',
          },
          pb:      {
            bgFrom: '#7C2D12', bgMid: '#C2410C', bgTo: '#FF6B35',
            accent: '#FFF7ED', badge: '个人最佳', emoji: '🏆',
          },
        }
        const t = themes[momentType] || themes.perfect

        // 背景渐变
        const bg = ctx.createLinearGradient(0, 0, W, H)
        bg.addColorStop(0, t.bgFrom)
        bg.addColorStop(0.55, t.bgMid)
        bg.addColorStop(1, t.bgTo)
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, W, H)

        // 同心环装饰（右上角）
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 2
        for (let i = 0; i < 6; i++) {
          ctx.beginPath()
          ctx.arc(W + 40, -40, 220 + i * 60, 0, Math.PI * 2)
          ctx.stroke()
        }

        // 顶部徽章 pill
        const badgeText = `${t.emoji}  ${t.badge}`
        ctx.font = '600 28px PingFang SC, sans-serif'
        const badgeW = ctx.measureText(badgeText).width + 56
        const badgeX = (W - badgeW) / 2
        const badgeY = 130
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        this._roundRect(ctx, badgeX, badgeY, badgeW, 56, 28)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(badgeText, W / 2, badgeY + 28)

        // 首次成就解锁副标题
        const firstUnlock = (momentType === 'perfect' && momentIsFirstPerfect)
          || (momentType === 'golden' && momentIsFirstGolden)
        if (firstUnlock) {
          ctx.font = '500 24px PingFang SC, sans-serif'
          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.fillText('🏅 成就解锁 · 首次达成', W / 2, 220)
        }

        // 中央大字分数
        ctx.fillStyle = t.accent
        ctx.font = '700 200px PingFang SC, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(momentCardScore), W / 2, H / 2 - 60)

        // 单位
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '500 40px PingFang SC, sans-serif'
        ctx.fillText(String(momentCardUnit), W / 2, H / 2 + 80)

        // 完美一组 / 收黄：画 6 个箭支圆
        if ((momentType === 'perfect' || momentType === 'golden') && momentArrows.length) {
          const n = momentArrows.length
          const r = 36
          const gap = 96
          const totalW = (n - 1) * gap
          const startX = (W - totalW) / 2
          const cy = H / 2 + 200
          momentArrows.forEach((a, i) => {
            const cx = startX + i * gap
            ctx.beginPath()
            ctx.arc(cx, cy, r, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255,255,255,0.95)'
            ctx.fill()
            ctx.fillStyle = '#1A1A2E'
            ctx.font = '700 32px PingFang SC, sans-serif'
            ctx.fillText(String(a), cx, cy + 2)
          })
        }

        // 底部 meta
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.font = '400 26px PingFang SC, sans-serif'
        ctx.fillText(String(momentCardMeta || ''), W / 2, H - 220)

        // 水印
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.font = '500 28px PingFang SC, sans-serif'
        ctx.fillText('箭证', W / 2, H - 130)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.font = '22px PingFang SC, sans-serif'
        ctx.fillText('用数据陪你练好每一支箭', W / 2, H - 80)

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

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
    this._snapshotActive()
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

    // 同步到云端（异步，不阻塞导航；失败时给用户提示，本地已留底）
    const api = require('../../utils/cloud')
    api.training.save(record).catch(e => {
      handleErr('training.cloudSave', e)
      wx.showToast({
        title: '云端同步失败，记录已存本地',
        icon: 'none',
        duration: 2500,
      })
    })

    this._clearActive()  // 已落库（本地+云端），清掉进行中存档
    wx.navigateBack()
  },

  continueSecondHalf() {
    this.setData({
      step: 3, isEndDone: false, endTotal: 0,
      endSlots: this._buildSlots([], this.data.arrowsPerEnd),
    })
    this._resetTimer()
    if (this.data.timerElimArrow) this._startTimer()
    this._snapshotActive()
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
      success: r => { if (r.confirm) { this._clearTimer(); this._clearActive(); wx.navigateBack() } },
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
    this._lastTickSec = null
    this._timer = setInterval(() => {
      const s   = Math.max(0, Math.round((this._timerTarget - Date.now()) / 1000))
      const pct = Math.round(s / this.data.timerTotal * 100)
      const st  = this._timerState(s, this.data.timerTotal)
      this.setData({ timerSecs: s, timerPct: pct, timerState: st, timerDisplay: fmtSecs(s) })
      this._tickSound(s)
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

  // 倒计时提示音：剩 10 秒一声、最后 5 秒每秒催促、归零长鸣。
  // 500ms 一跳、s 为整秒会重复，靠 _lastTickSec 去重；s 跌出窗口外不响。
  // 记分与撒放两个计时器互斥（撒放是训练前热身步骤），共用此方法即可。
  _tickSound(s) {
    if (s === this._lastTickSec) return
    this._lastTickSec = s
    if (s === 0) { sfx.end(); return }
    if (s === 10 || (s >= 1 && s <= 5)) sfx.beep()
  },

  _timerState(s, total) {
    if (total === 0) return 'normal'
    const warnAt = total >= 60 ? 45 : Math.floor(total / 2)
    const critAt = total >= 60 ? 15 : Math.max(5, Math.floor(total / 5))
    if (s <= critAt) return 'critical'
    if (s <= warnAt) return 'warning'
    return 'normal'
  },

  onShareAppMessage() {
    return getApp().defaultShare()
  },
})
