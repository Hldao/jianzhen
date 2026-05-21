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

function buildAchievements(totalSessions, streak, goldenEndData, perfectEndData) {
  const now = Date.now()

  // 里程碑成就首次解锁时自动存储时间
  if (totalSessions > 0 && !wx.getStorageSync('achievement_first'))
    wx.setStorageSync('achievement_first', { earnedAt: now })
  if (streak >= 7 && !wx.getStorageSync('achievement_week'))
    wx.setStorageSync('achievement_week', { earnedAt: now })
  if (totalSessions >= 20 && !wx.getStorageSync('achievement_veteran'))
    wx.setStorageSync('achievement_veteran', { earnedAt: now })
  if (streak >= 30 && !wx.getStorageSync('achievement_month'))
    wx.setStorageSync('achievement_month', { earnedAt: now })

  const firstData   = totalSessions > 0 ? wx.getStorageSync('achievement_first')   || null : null
  const weekData    = streak >= 7        ? wx.getStorageSync('achievement_week')    || null : null
  const veteranData = totalSessions >= 20? wx.getStorageSync('achievement_veteran') || null : null
  const monthData   = streak >= 30       ? wx.getStorageSync('achievement_month')   || null : null

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
    eventCount: 0,
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
    this._load()
  },

  async _load() {
    const app = getApp()
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
        api.training.list({ limit: 200 }),
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
        eventCount: statsRes.eventCount,
        unreadCount: unreadRes.count || 0,
        achievements: buildAchievements(sessions, streak, wx.getStorageSync('achievement_golden_end') || null, wx.getStorageSync('achievement_perfect_end') || null),
      })
    } catch (e) {
      console.warn('mine load failed', e)
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

  openMyEvents() {
    wx.navigateTo({ url: '/pages/myevents/myevents' })
  },

  openNotifications() {
    wx.navigateTo({ url: '/pages/notification/notification' })
  },

  openPublisher() {
    wx.navigateTo({ url: '/pages/publisher/publisher' })
  },

  openAbout() {
    wx.showToast({ title: '箭证 v1.0.0', icon: 'none' })
  },

  shareApp() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  },

})
