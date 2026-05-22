Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    activeTab: 'all',
    loading: true,
    notifications: [],
    filtered: [],
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  async onShow() {
    wx.removeTabBarBadge({ index: 2 })
    this._load()
    // 进入通知页即标记所有为已读（无需等待）
    try {
      const api = require('../../utils/cloud')
      api.social.markAllRead().catch(() => {})
    } catch (e) {}
  },

  async _load() {
    this.setData({ loading: true })
    try {
      const api = require('../../utils/cloud')
      const res = await api.social.getNotifications()
      const list = (res.list || []).map(n => ({
        ...n,
        timeLabel: this._timeLabel(n.ts || n.createdAt),
      }))
      this.setData({ notifications: list, loading: false })
      this._applyFilter()
    } catch (e) {
      console.warn('notification load failed', e)
      this.setData({ loading: false })
    }
  },

  _timeLabel(ts) {
    if (!ts) return ''
    const diff = Date.now() - ts
    const min = Math.floor(diff / 60000)
    if (min < 1) return '刚刚'
    if (min < 60) return `${min}分钟前`
    const h = Math.floor(min / 60)
    if (h < 24) return `${h}小时前`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}天前`
    const date = new Date(ts)
    return `${date.getMonth()+1}/${date.getDate()}`
  },

  _applyFilter() {
    const { notifications, activeTab } = this.data
    const filtered = activeTab === 'all'
      ? notifications
      : notifications.filter(n => n.type === activeTab)
    this.setData({ filtered })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this._applyFilter()
  },

  async markAllRead() {
    const { notifications } = this.data
    const updated = notifications.map(n => ({ ...n, read: true }))
    this.setData({ notifications: updated })
    this._applyFilter()
    try {
      const api = require('../../utils/cloud')
      await api.social.markAllRead()
    } catch (e) {
      console.warn('markAllRead failed', e)
    }
  },

  async tapNotif(e) {
    const { id, index } = e.currentTarget.dataset
    const notifications = [...this.data.notifications]
    const idx = notifications.findIndex(n => n._id === id)
    if (idx >= 0 && !notifications[idx].read) {
      notifications[idx] = { ...notifications[idx], read: true }
      this.setData({ notifications })
      this._applyFilter()
      try {
        const api = require('../../utils/cloud')
        await api.social.markRead({ id })
      } catch (e) {
        console.warn('markRead failed', e)
      }
    }
  },

  goBack() {
    wx.navigateBack()
  },
})
