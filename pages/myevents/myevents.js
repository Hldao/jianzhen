Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    activeTab: 'active',
    loading: true,
    list: [],
    allList: [],
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  async onShow() {
    this._load()
  },

  async _load() {
    this.setData({ loading: true })
    try {
      const api = require('../../utils/cloud')
      const res = await api.event.getMyRegistrations()
      const now = Date.now()
      const all = (res.list || []).map(item => {
        const endTs = item.eventEndTs || 0
        const isEnded = endTs && endTs < now
        return {
          ...item,
          _ended: isEnded,
          statusLabel: this._statusLabel(item.status),
          regTimeLabel: this._timeLabel(item.createdAt),
        }
      })
      this.setData({ allList: all, loading: false })
      this._applyTab()
    } catch (e) {
      console.warn('myevents load failed', e)
      this.setData({ loading: false, list: [] })
    }
  },

  _statusLabel(s) {
    const map = {
      pending:  '待审核',
      approved: '已确认',
      rejected: '未通过',
      paid:     '已缴费',
    }
    return map[s] || '已报名'
  },

  _timeLabel(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    return `${d.getMonth()+1}月${d.getDate()}日`
  },

  _applyTab() {
    const { allList, activeTab } = this.data
    const list = activeTab === 'active'
      ? allList.filter(i => !i._ended)
      : allList.filter(i => i._ended)
    this.setData({ list })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this._applyTab()
  },

  tapEvent(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/events/detail?id=${id}` })
  },

  goEvents() {
    wx.switchTab({ url: '/pages/events/events' })
  },

  loadMore() {},

  goBack() {
    wx.navigateBack()
  },
})
