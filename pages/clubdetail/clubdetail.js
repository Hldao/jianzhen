// 俱乐部详情 5 分钟缓存（globalData，跨页面共享）
const CLUB_CACHE_TTL = 5 * 60 * 1000

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
    this._clubId = options.id
    if (options.id) this._load(options.id)
    else wx.navigateBack()
  },

  async _load(clubId) {
    // 5 分钟缓存
    const app = getApp()
    app.globalData.clubDetailCache = app.globalData.clubDetailCache || {}
    const cached = app.globalData.clubDetailCache[clubId]
    if (cached && Date.now() - cached.ts < CLUB_CACHE_TTL) {
      this.setData({ ...cached.data, loading: false })
      return
    }

    try {
      const api = require('../../utils/cloud')
      const res = await api.social.getClubDetail({ clubId })
      if (res.code !== 0) { wx.navigateBack(); return }
      const data = {
        club: res.club,
        members: res.members,
        isJoined: res.isJoined,
      }
      this.setData({ ...data, loading: false })
      app.globalData.clubDetailCache[clubId] = { ts: Date.now(), data }
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
      const newMemberCount = (club.memberCount || 0) + delta
      this.setData({
        isJoined: !isJoined,
        'club.memberCount': newMemberCount,
      })
      // 同步缓存（避免下次进入显示旧 isJoined / memberCount）
      const app = getApp()
      const cached = app.globalData.clubDetailCache && app.globalData.clubDetailCache[club._id]
      if (cached) {
        cached.data.isJoined = !isJoined
        cached.data.club = { ...cached.data.club, memberCount: newMemberCount }
      }
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
