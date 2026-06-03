const { handleErr } = require('../../utils/error')

// ── 日期工具 ──────────────────────────────────────────────────────
function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function daysBetween(keyA, keyB) {
  return Math.round((new Date(keyB) - new Date(keyA)) / 86400000)
}
function getWeekStart(d) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setHours(0, 0, 0, 0)
  mon.setDate(d.getDate() + diff)
  return mon
}

function rts(r) { return r.ts ?? r.id }   // 兼容云端(ts)和本地缓存(id)

function computeHomeData(records) {
  const now          = new Date()
  const todayKey     = toDateKey(now)
  const yesterdayKey = toDateKey(new Date(+now - 86400000))
  const trainedSet   = new Set(records.map(r => toDateKey(new Date(rts(r)))))
  const sortedDays   = [...trainedSet].sort().reverse()

  // ── 连续天数 ──
  const trainedToday     = trainedSet.has(todayKey)
  const trainedYesterday = trainedSet.has(yesterdayKey)
  const active = trainedToday || trainedYesterday

  let runStart = sortedDays[0] || todayKey
  if (active) {
    let idx = 0
    for (let i = 1; i < sortedDays.length; i++) {
      if (daysBetween(sortedDays[i], sortedDays[i-1]) <= 2) idx = i
      else break
    }
    runStart = sortedDays[idx]
  }
  const current = active ? daysBetween(runStart, todayKey) + 1 : 0

  let longest = current
  let cur = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const gap = daysBetween(sortedDays[i], sortedDays[i-1])
    if (gap <= 2) { cur++; if (cur > longest) longest = cur }
    else cur = 1
  }

  const frozen = active && !trainedToday
  const state  = current === 0 ? 'broken' : frozen ? 'frozen' : 'active'
  const sub = {
    active:  '连续训练中',
    frozen:  '今日打卡即可延续',
    broken:  longest ? '历史最长，重新出发' : '开始你的连续训练',
  }[state]
  const tag = {
    active: '连续',
    frozen: '连续',
    broken: longest ? '最长' : '',
  }[state]
  const num = current > 0 ? current : longest

  // last 7 days pills
  const last7 = Array.from({ length: 7 }, (_, i) =>
    trainedSet.has(toDateKey(new Date(+now - (6 - i) * 86400000)))
  )

  // ── 周数据 ──
  const monTs     = getWeekStart(now).getTime()
  const lastMonTs = monTs - 7 * 86400000
  const avgOf = rs => {
    const arrows = rs.reduce((s, r) => s + r.totalArrows, 0)
    const score  = rs.reduce((s, r) => s + r.totalScore, 0)
    return arrows > 0 ? Math.round(score / arrows * 10) / 10 : null
  }
  const thisWeek = records.filter(r => rts(r) >= monTs)
  const lastWeek = records.filter(r => rts(r) >= lastMonTs && rts(r) < monTs)
  const weekCount = thisWeek.length
  const weekAvg   = avgOf(thisWeek)
  const lastAvg   = avgOf(lastWeek)
  const rawDiff   = weekAvg !== null && lastAvg !== null
    ? Math.round((weekAvg - lastAvg) * 10) / 10 : null

  return {
    streakNum:   num,
    streakTag:   tag,
    streakSub:   sub,
    streakState: state,
    last7,
    weekCount,
    weekAvgStr:  weekAvg !== null ? String(weekAvg) : '--',
    showDiff:    rawDiff !== null,
    weekDiffStr: rawDiff !== null ? (rawDiff >= 0 ? `+${rawDiff}` : String(rawDiff)) : '',
    weekDiffUp:  rawDiff !== null ? rawDiff >= 0 : true,
    totalSessions: records.length,
  }
}

const QUOTES = [
  { text: '不积跬步，无以至千里', author: '— 荀子《劝学》' },
  { text: '精准来自重复\n卓越来自坚持', author: '— 弓道精要' },
  { text: '每一箭都是对自我的超越', author: '' },
  { text: '我练习得越多，运气便越好', author: '— 盖瑞·普雷尔' },
  { text: '强大不是天生的\n是一箭一箭练出来的', author: '' },
  { text: '熟能生巧，巧能生精', author: '— 中国古谚' },
  { text: '胜利属于那些坚持到最后的人', author: '— 拿破仑' },
  { text: '专注当下\n每一箭都值得全力以赴', author: '' },
]
let _quoteShown = false

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    showQuote: false,
    quoteText: '',
    quoteAuthor: '',
    // 连续训练 + 周数据（合并卡片）
    streakNum: 0,
    streakTag: '',
    streakSub: '开始你的连续训练',
    streakState: 'broken',
    last7: [false,false,false,false,false,false,false],
    weekCount: 0,
    weekAvgStr: '--',
    showDiff: false,
    weekDiffStr: '',
    weekDiffUp: true,
    totalSessions: 0,

    // 训练目标
    goalSet: false,
    goalDist: '',
    goalBow: '',
    goalCurrent: 0,
    goalTarget: 0,
    goalPct: 0,
    goalDiff: 0,
    goalDone: false,
    goalDaysLeft: 0,
    goalDeadlineStr: '',

    // 箭友动态 · 支持分页上滑加载
    feeds: [],
    feedEmpty: false,
    feedLoading: true,
    feedLoadingMore: false,
    feedSkip: 0,
    feedHasMore: true,

    // 隐私授权弹层
    showPrivacy: false,

    // 首次进入引导授权头像昵称 · 微信新规要求用户主动点击触发
    showOnboarding:  false,
    obAvatarUrl:     '',
    obNickName:      '',
    obSaving:        false,
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
    if (!_quoteShown) {
      _quoteShown = true
      const q = QUOTES[Math.floor(Math.random() * QUOTES.length)]
      this.setData({ showQuote: true, quoteText: q.text, quoteAuthor: q.author })
      this._quoteTimer = setTimeout(() => this.setData({ showQuote: false }), 4200)
    }
    this._checkPrivacy()
  },

  onUnload() {
    if (this._quoteTimer) clearTimeout(this._quoteTimer)
  },

  async onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 0 })
    }
    this._checkPrivacy()

    // 立即用本地缓存填充，避免白屏
    const cached = wx.getStorageSync('training_history') || []
    if (cached.length > 0) this.setData(computeHomeData(cached))

    // 训练记录 + 未读通知数 并行拉取（之前串行造成首屏白屏 ~ 1.5s）
    // Promise.allSettled 让一个失败不影响另一个
    const api = require('../../utils/cloud')
    const [trainRes, notifRes] = await Promise.allSettled([
      api.training.list({ limit: 60 }),
      api.social.getUnreadCount(),
    ])

    if (trainRes.status === 'fulfilled' && trainRes.value.records) {
      wx.setStorageSync('training_history', trainRes.value.records)
      this.setData(computeHomeData(trainRes.value.records))
    } else {
      const stored = wx.getStorageSync('training_history') || []
      this.setData(computeHomeData(stored))
    }

    if (notifRes.status === 'fulfilled' && notifRes.value && notifRes.value.count > 0) {
      wx.setTabBarBadge({ index: 2, text: String(notifRes.value.count) })
    } else {
      wx.removeTabBarBadge({ index: 2 })
    }

    // 训练目标（本地读取，无需网络）
    this._loadGoal()

    // 拉取箭友动态（不阻塞主流程，async 函数 fire-and-forget）
    this._loadFeed()

    // 首次进入 → 引导用户授权头像 + 昵称
    this._checkOnboarding()

  },

  _loadGoal() {
    const goal = wx.getStorageSync('training_goal')
    if (!goal || !goal.score) {
      this.setData({ goalSet: false })
      return
    }
    const history = wx.getStorageSync('training_history') || []
    const matched = history.filter(r => r.distance === goal.dist && r.bowType === goal.bow)
    const current = matched.length > 0 ? Math.max(...matched.map(r => r.totalScore)) : 0
    const diff = goal.score - current
    const done = diff <= 0
    const pct  = goal.score > 0 ? Math.min(100, Math.round(current / goal.score * 100)) : 0
    const deadline = new Date(goal.deadline)
    const daysLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 86400000))
    this.setData({
      goalSet: true,
      goalDist: goal.dist,
      goalBow: goal.bow,
      goalCurrent: current,
      goalTarget: goal.score,
      goalPct: pct,
      goalDiff: diff,
      goalDone: done,
      goalDaysLeft: daysLeft,
      goalDeadlineStr: `${deadline.getMonth() + 1}月${deadline.getDate()}日`,
    })
  },

  async _loadFeed(append = false) {
    if (append) {
      if (this.data.feedLoadingMore || !this.data.feedHasMore) return
      this.setData({ feedLoadingMore: true })
    }
    try {
      const api = require('../../utils/cloud')
      const skip = append ? this.data.feedSkip : 0
      const limit = 10
      const res = await api.social.getPublicFeed({ limit, skip })
      const newFeeds = (res.feed || []).map(f => ({
        ...f,
        timeLabel:  this._formatFeedTime(f.ts),
        likes:      f.likes || 0,
        liked:      f.liked || false,
        tag:        f.tag || (f.isPB ? '个人最佳' : f.streakDay >= 7 ? `连续训练第 ${f.streakDay} 天` : ''),
        sourceType: f.sourceType || '',
      }))
      const allFeeds = append ? this.data.feeds.concat(newFeeds) : newFeeds
      this.setData({
        feeds: allFeeds,
        feedEmpty:       allFeeds.length === 0,
        feedLoading:     false,
        feedLoadingMore: false,
        feedSkip:        (append ? this.data.feedSkip : 0) + newFeeds.length,
        feedHasMore:     newFeeds.length >= limit,
      })
    } catch (e) {
      this.setData({ feedLoading: false, feedLoadingMore: false, feedEmpty: !append })
    }
  },

  onScrollToLower() {
    this._loadFeed(true)
  },

  // 格式化动态时间
  _formatFeedTime(ts) {
    const diff = Date.now() - ts
    if (diff < 60000)        return '刚刚'
    if (diff < 3600000)      return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000)     return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 86400000 * 3) return `${Math.floor(diff / 86400000)}天前`
    const d = new Date(ts)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  },

  _checkPrivacy() {
    const app = getApp()
    if (app.globalData.privacyNeeded && !this.data.showPrivacy) {
      app.globalData.privacyNeeded = false
      this.setData({ showPrivacy: true })
    }
  },

  agreePrivacy() {
    this.setData({ showPrivacy: false })
    // 隐私同意后立即检查 onboarding（首次进入时两个 modal 不重叠，按顺序弹）
    this._checkOnboarding()
  },

  disagreePrivacy() {
    wx.showModal({
      title: '无法继续',
      content: '您需要同意《隐私政策》才能正常使用箭证。',
      showCancel: false,
      confirmText: '重新阅读',
    })
  },

  // ──── 首次引导授权头像/昵称 ────────────────────────────────────
  _checkOnboarding() {
    const app = getApp()
    // 隐私授权弹层优先；隐私关掉后才能弹 onboarding（避免两个 modal 叠加）
    if (app.globalData.needOnboarding && !this.data.showPrivacy && !this.data.showOnboarding) {
      // 预填 globalData.userInfo 中已有的（可能是 isNew 但 ts 未补全）
      const u = app.globalData.userInfo || {}
      this.setData({
        showOnboarding: true,
        obAvatarUrl: u.avatarUrl || '',
        obNickName: u.nickName || '',
      })
    }
  },

  onChooseObAvatar(e) {
    this.setData({ obAvatarUrl: e.detail.avatarUrl })
  },
  onObNicknameInput(e) {
    this.setData({ obNickName: e.detail.value })
  },

  async submitOnboarding() {
    if (this.data.obSaving) return
    const nickName = (this.data.obNickName || '').trim()
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    let avatarUrl = this.data.obAvatarUrl
    if (!avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    this.setData({ obSaving: true })
    wx.showLoading({ title: '保存中…', mask: true })
    try {
      // 本地临时头像 → 上传到云存储（跟 profile.js 一致）
      if (!avatarUrl.startsWith('cloud://') && !avatarUrl.startsWith('http')) {
        const ext = (avatarUrl.match(/\.([a-zA-Z]+)(?:\?|$)/) || [, 'jpg'])[1]
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: avatarUrl })
        avatarUrl = up.fileID
      }
      const api = require('../../utils/cloud')
      await api.user.updateProfile({ avatarUrl, nickName })
      const app = getApp()
      app.globalData.userInfo = { ...app.globalData.userInfo, avatarUrl, nickName }
      app.globalData.needOnboarding = false
      app.globalData.profileDirty = true
      wx.setStorageSync('onboarding_done', true)
      wx.hideLoading()
      this.setData({ showOnboarding: false, obSaving: false })
      wx.showToast({ title: '欢迎，箭友', icon: 'success' })
    } catch (e) {
      handleErr('index.onboardingSave', e)
      wx.hideLoading()
      this.setData({ obSaving: false })
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  skipOnboarding() {
    // 写 storage 避免下次再弹（用户主动跳过的意思）
    // 用户后续可以去「我的 → 编辑资料」补全
    wx.setStorageSync('onboarding_done', true)
    const app = getApp()
    app.globalData.needOnboarding = false
    this.setData({ showOnboarding: false })
  },

  noop() {}, // 阻止 modal 内层点击冒泡到遮罩

  goGoal() {
    wx.navigateTo({ url: '/pages/goal/goal' })
  },

  toggleLike(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.feeds[idx]
    if (!item) return
    this._likingIds = this._likingIds || new Set()
    if (this._likingIds.has(item._id)) return  // 互斥：等当前请求完成再响应下一次
    this._likingIds.add(item._id)

    const liked = !item.liked
    this.setData({
      [`feeds[${idx}].liked`]: liked,
      [`feeds[${idx}].likes`]: liked ? item.likes + 1 : Math.max(0, item.likes - 1),
    })
    const api = require('../../utils/cloud')
    const req = liked ? api.social.likePost({ feedId: item._id })
                      : api.social.unlikePost({ feedId: item._id })
    req
      .catch(() => {
        // 失败回滚 UI
        const cur = this.data.feeds[idx]
        if (cur && cur._id === item._id) {
          this.setData({
            [`feeds[${idx}].liked`]: !liked,
            [`feeds[${idx}].likes`]: liked ? Math.max(0, cur.likes - 1) : cur.likes + 1,
          })
        }
      })
      .finally(() => { this._likingIds.delete(item._id) })
  },

  openTraining() {
    wx.navigateTo({ url: '/pages/training/training' })
  },

  // 打开历史记录
  openHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  // 打开数据分析
  openStats() {
    wx.switchTab({ url: '/pages/data/data' })
  },

  async openFeedDetail(e) {
    const { id, isMine, openid } = e.currentTarget.dataset
    if (!isMine) {
      if (openid) wx.navigateTo({ url: `/pages/userprofile/userprofile?openid=${openid}` })
      return
    }
    if (!id) return
    try {
      wx.showLoading({ title: '加载中…', mask: true })
      const api = require('../../utils/cloud')
      const res = await api.training.getOne(id)
      wx.hideLoading()
      if (res.record) {
        getApp().globalData.currentRecord = res.record
        wx.navigateTo({ url: '/pages/detail/detail' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 空状态引导：去发现箭友
  goExplore() {
    wx.navigateTo({ url: '/pages/explore/explore' })
  },

  onShareAppMessage() {
    return getApp().defaultShare({ title: '箭证 · 跟我一起把训练数据用起来' })
  },

  onShareTimeline() {
    return { title: '箭证 · 用数据陪你练好每一支箭', query: '' }
  },

  // 切换 Tab
  switchTab(e) {
    const { tab } = e.currentTarget.dataset
    const pages = {
      index: '/pages/index/index',
      data: '/pages/data/data',
      mine: '/pages/mine/mine'
    }
    if (tab !== 'index') {
      wx.switchTab({ url: pages[tab] })
    }
  }
})
