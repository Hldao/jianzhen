Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    loading: true,
    club: null,
    members: [],
    isJoined: false,
    joining: false,
  },

  onLoad(options) {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
    if (options.id) this._load(options.id)
    else wx.navigateBack()
  },

  async _load(clubId) {
    try {
      const api = require('../../utils/cloud')
      const res = await api.social.getClubDetail({ clubId })
      if (res.code !== 0) { wx.navigateBack(); return }
      this.setData({
        club: res.club,
        members: res.members,
        isJoined: res.isJoined,
        loading: false,
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async toggleJoin() {
    if (this.data.joining || !this.data.club) return
    this.setData({ joining: true })
    const { isJoined, club } = this.data
    const api = require('../../utils/cloud')
    try {
      if (isJoined) {
        await api.social.leaveClub({ clubId: club._id })
      } else {
        await api.social.joinClub({ clubId: club._id })
      }
      const delta = isJoined ? -1 : 1
      this.setData({
        isJoined: !isJoined,
        'club.memberCount': (club.memberCount || 0) + delta,
      })
    } catch (e) {
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    } finally {
      this.setData({ joining: false })
    }
  },

  goUserProfile(e) {
    const { openid } = e.currentTarget.dataset
    if (openid) wx.navigateTo({ url: `/pages/userprofile/userprofile?openid=${openid}` })
  },

  goBack() { wx.navigateBack() },
})
