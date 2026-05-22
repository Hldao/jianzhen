function levelLabel(n) {
  if (n >= 50) return '精英射手'
  if (n >= 20) return '射箭高手'
  if (n >= 10) return '训练达人'
  if (n >= 5)  return '训练新人'
  return '初学者'
}

function fmtTime(ts) {
  const diff = Date.now() - ts
  if (diff < 86400000)     return `${Math.floor(diff / 3600000) || 1}小时前`
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)}天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const MODE_LABEL = { ranking: '积分赛', elimination: '淘汰赛', custom: '自由练习' }

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    loading: true,
    user: null,
    levelLabel: '',
    totalSessions: 0,
    recentFeed: [],
  },

  onLoad(options) {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
    if (options.openid) this._load(options.openid)
    else wx.navigateBack()
  },

  async _load(openid) {
    try {
      const api = require('../../utils/cloud')
      const res = await api.social.getUserProfile({ targetOpenid: openid })
      if (res.code !== 0) { wx.navigateBack(); return }
      this.setData({
        user: res.user,
        levelLabel: levelLabel(res.totalSessions),
        totalSessions: res.totalSessions,
        recentFeed: res.recentFeed.map(f => ({
          ...f,
          modeLabel: MODE_LABEL[f.mode] || f.mode,
          timeLabel: fmtTime(f.ts),
        })),
        loading: false,
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  goBack() { wx.navigateBack() },
})
