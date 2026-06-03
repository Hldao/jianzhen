const { handleErr } = require('../../utils/error')

const VERSION = '1.0.0'
// 上线前请将下面的微信号替换为你的真实微信号
const CONTACT_WECHAT = 'YOUR_WECHAT_ID'

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    version: VERSION,
    contactWechat: CONTACT_WECHAT,
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  // 跳转到微信审核通过的「用户隐私保护指引」
  openPrivacyContract() {
    if (!wx.openPrivacyContract) {
      wx.showToast({ title: '请升级微信版本', icon: 'none' })
      return
    }
    wx.openPrivacyContract({
      fail: e => {
        handleErr('about.openPrivacy', e)
        wx.showToast({ title: '协议加载失败', icon: 'none' })
      }
    })
  },

  // 复制微信号
  copyWechat() {
    if (!this.data.contactWechat || this.data.contactWechat === 'YOUR_WECHAT_ID') {
      wx.showToast({ title: '联系方式即将开放', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: this.data.contactWechat,
      success: () => wx.showToast({ title: '微信号已复制', icon: 'success' }),
      fail:    e => handleErr('about.copyWechat', e),
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onShareAppMessage() {
    return getApp().defaultShare()
  },
})
