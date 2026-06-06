const { handleErr } = require('../../utils/error')

function rts(r) { return r.ts ?? r.id }

function getWeekStart(d) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setHours(0, 0, 0, 0)
  mon.setDate(d.getDate() + diff)
  return mon
}

function computeStreak(records) {
  if (!records.length) return 0
  const now = new Date()
  const todayKey = toDateKey(now)
  const yesterdayKey = toDateKey(new Date(+now - 86400000))
  const trainedSet = new Set(records.map(r => toDateKey(new Date(rts(r)))))

  const active = trainedSet.has(todayKey) || trainedSet.has(yesterdayKey)
  if (!active) return 0

  const sorted = [...trainedSet].sort().reverse()
  let idx = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((new Date(sorted[i-1]) - new Date(sorted[i])) / 86400000)
    if (gap <= 2) idx = i
    else break
  }
  return Math.round((new Date(todayKey) - new Date(sorted[idx])) / 86400000) + 1
}

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function levelLabel(sessions) {
  if (sessions >= 50) return '精英射手'
  if (sessions >= 20) return '射箭高手'
  if (sessions >= 10) return '训练达人'
  if (sessions >= 5)  return '训练新人'
  return '初学者'
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function readOrInit(key, condition, now) {
  if (!condition) return null
  let data = wx.getStorageSync(key) || null
  if (!data) {
    data = { earnedAt: now }
    wx.setStorageSync(key, data)
  }
  return data
}

function buildAchievements(totalSessions, streak, goldenEndData, perfectEndData) {
  const now = Date.now()

  const firstData   = readOrInit('achievement_first',   totalSessions > 0,   now)
  const weekData    = readOrInit('achievement_week',    streak >= 7,         now)
  const veteranData = readOrInit('achievement_veteran', totalSessions >= 20, now)
  const monthData   = readOrInit('achievement_month',   streak >= 30,        now)

  // 勤奋射手 = 连续7天 OR 累计20次（合并）
  const diligentData = weekData || veteranData

  return [
    {
      id: 'first',
      name: '初心者',
      icon: 'star',
      desc: '完成第一次训练',
      colorCls: firstData ? 'lc-yellow' : 'lc-gray',
      bg: firstData ? 'linear-gradient(135deg,#FCE7F3,#FBCFE8)' : '#E8ECF2',
      locked: !firstData,
      unlockedAtStr: firstData ? formatDate(firstData.earnedAt) : '',
    },
    {
      id: 'golden_end',
      name: '收黄',
      icon: 'sun',
      desc: '非淘汰赛模式下，一组全部箭矢命中黄心（9环及以上）',
      colorCls: goldenEndData ? 'lc-yellow' : 'lc-gray',
      bg: goldenEndData ? 'linear-gradient(135deg,#FEF9C3,#FDE68A)' : '#E8ECF2',
      locked: !goldenEndData,
      sub: goldenEndData ? `×${goldenEndData.count}` : '',
      unlockedAtStr: goldenEndData ? formatDate(goldenEndData.earnedAt) : '',
      repeatable: true,
      count: goldenEndData ? goldenEndData.count : 0,
    },
    {
      id: 'perfect',
      name: '完美一组',
      icon: 'crosshair',
      desc: '一组箭矢全部命中X环或10环',
      colorCls: perfectEndData ? 'lc-primary' : 'lc-gray',
      bg: perfectEndData ? 'linear-gradient(135deg,#FFE4D6,#FFC7A8)' : '#E8ECF2',
      locked: !perfectEndData,
      sub: perfectEndData ? `×${perfectEndData.count}` : '',
      unlockedAtStr: perfectEndData ? formatDate(perfectEndData.earnedAt) : '',
      repeatable: true,
      count: perfectEndData ? perfectEndData.count : 0,
    },
    {
      id: 'veteran',
      name: '勤奋射手',
      icon: 'zap',
      desc: '连续训练满7天，或累计完成20次训练',
      colorCls: diligentData ? 'lc-green' : 'lc-gray',
      bg: diligentData ? 'linear-gradient(135deg,#D1FAE5,#A7F3D0)' : '#E8ECF2',
      locked: !diligentData,
      unlockedAtStr: diligentData ? formatDate(diligentData.earnedAt) : '',
      progress: `当前连续 ${streak} 天 · 累计 ${totalSessions} 次`,
    },
    {
      id: 'month',
      name: '坚持30天',
      icon: 'snowflake',
      desc: '连续训练满30天',
      colorCls: monthData ? 'lc-indigo' : 'lc-gray',
      bg: monthData ? 'linear-gradient(135deg,#EDE9FE,#DDD6FE)' : '#E8ECF2',
      locked: !monthData,
      unlockedAtStr: monthData ? formatDate(monthData.earnedAt) : '',
      progress: `当前连续 ${streak} 天`,
    },
  ]
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,

    avatarUrl: '',
    nickName: '',
    levelLabel: '初学者',
    streakDays: 0,
    clubName: '',

    totalSessions: 0,
    bestScore: 0,
    unreadCount: 0,

    achievements: [],
    showAllAchievements: false,
    activeAchievement: null,
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  async onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 2 })
    }
    wx.removeTabBarBadge({ index: 2 })
    this._load()
  },

  async _load() {
    const now = Date.now()
    const app = getApp()
    if (app.globalData.profileDirty) {
      app.globalData.profileDirty = false
      this._lastLoadTime = 0  // 强制刷新
    }
    if (this._lastLoadTime && now - this._lastLoadTime < 60000) return
    this._lastLoadTime = now
    const cached = app.globalData.userInfo
    if (cached) {
      this.setData({
        nickName: cached.nickName || '箭证用户',
        avatarUrl: cached.avatarUrl || '',
      })
    }

    try {
      const api = require('../../utils/cloud')
      const [profileRes, statsRes, recordsRes, unreadRes] = await Promise.all([
        api.user.getProfile(),
        api.user.getStats(),
        api.training.list({ limit: 60 }),
        api.social.getUnreadCount(),
      ])

      const user = profileRes.user
      app.globalData.userInfo = user

      const streak = computeStreak(recordsRes.records || [])
      const sessions = statsRes.totalSessions
      const best = statsRes.bestScore || 0

      this.setData({
        nickName: user.nickName || '箭证用户',
        avatarUrl: user.avatarUrl || '',
        clubName: user.club || '',
        levelLabel: levelLabel(sessions),
        streakDays: streak,
        totalSessions: sessions,
        bestScore: best,
        unreadCount: unreadRes.count || 0,
        achievements: buildAchievements(sessions, streak, wx.getStorageSync('achievement_golden_end') || null, wx.getStorageSync('achievement_perfect_end') || null),
      })
    } catch (e) {
      handleErr('mine.load', e)
      const stored = wx.getStorageSync('training_history') || []
      const streak = computeStreak(stored)
      this.setData({
        streakDays: streak,
        achievements: buildAchievements(0, streak, wx.getStorageSync('achievement_golden_end') || null, wx.getStorageSync('achievement_perfect_end') || null),
      })
    }
  },

  toggleAchievements() {
    this.setData({ showAllAchievements: !this.data.showAllAchievements })
  },

  openAchievementDetail(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ activeAchievement: this.data.achievements[idx] })
  },

  closeAchievementDetail() {
    this.setData({ activeAchievement: null })
  },

  noop() {},

  editProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  openNotifications() {
    wx.navigateTo({ url: '/pages/notification/notification' })
  },

  openAbout() {
    wx.navigateTo({ url: '/pages/about/about' })
  },

  // 注销账号：永久删除账号及全部数据（云端 + 本地），重置为全新状态
  deleteAccount() {
    wx.showModal({
      title: '注销账号',
      content: '注销后，你的账号资料、训练记录、动态、目标等全部数据将被永久删除，无法恢复。确定注销吗？',
      confirmText: '注销',
      confirmColor: '#E63946',
      success: async (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '注销中…', mask: true })
        try {
          const api = require('../../utils/cloud')
          await api.user.deleteAccount()
          // 清空全部本地数据，回到「从未登录」的全新状态
          wx.clearStorageSync()
          // 清 globalData 的 5 分钟内存缓存（userProfileCache / clubDetailCache），
          // 否则注销后立即看俱乐部/箭友会读到旧 isJoined 状态
          const app = getApp()
          app.globalData.userInfo = null
          app.globalData.userProfileCache = {}
          app.globalData.clubDetailCache = {}
          app.globalData.currentRecord = null
          // 重新登录会创建一个全新的空账号，避免后续页面无用户而报错
          try {
            const res = await api.user.login()
            app.globalData.userInfo = res.user
          } catch (e) { /* 离线也无妨，下次启动会重新登录 */ }
          app.globalData.profileDirty = true
          wx.hideLoading()
          wx.showToast({ title: '账号已注销', icon: 'success' })
          // 重置页面栈，回到首页全新状态
          setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 800)
        } catch (e) {
          wx.hideLoading()
          handleErr('mine.deleteAccount', e)
          wx.showToast({ title: '注销失败，请重试', icon: 'none' })
        }
      },
    })
  },

  onShareAppMessage() {
    return getApp().defaultShare({ title: '一起用箭证记录训练，比比谁进步快' })
  },

  onShareTimeline() {
    return { title: '箭证 · 用数据陪你练好每一支箭', query: '' }
  },

})
