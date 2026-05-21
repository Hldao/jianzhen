Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,

    orgName: '射箭俱乐部',
    publishedCount: 0,
    totalRegs: 0,
    pendingCount: 0,
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
    try {
      const api = require('../../utils/cloud')
      const res = await api.event.getPublisherStats()
      this.setData({
        orgName:        res.orgName || '射箭俱乐部',
        publishedCount: res.publishedCount || 0,
        totalRegs:      res.totalRegs || 0,
        pendingCount:   res.pendingCount || 0,
      })
    } catch (e) {
      console.warn('publisher stats load failed', e)
    }
  },

  goBack() {
    wx.navigateBack()
  },

  openCreateEvent() {
    wx.navigateTo({ url: '/pages/createevent/createevent' })
  },

  openRegManage() {
    wx.navigateTo({ url: '/pages/regmanage/regmanage' })
  },

  openMyPublished() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },
})
