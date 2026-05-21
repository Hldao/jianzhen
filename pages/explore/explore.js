Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    activeTab: 'users',

    users: [],
    usersLoading: true,

    clubs: [],
    clubsLoading: true,
    clubKeyword: '',

    showCreateClub: false,
    creatingClub: false,
    newClubName: '',
    newClubCity: '',
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
    this._loadUsers()
    this._loadClubs()
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  goBack() {
    wx.navigateBack()
  },

  // ── 箭友列表 ────────────────────────────────────────────────────
  async _loadUsers() {
    try {
      const api = require('../../utils/cloud')
      const res = await api.social.listUsers({ limit: 30 })
      this.setData({ users: res.users || [], usersLoading: false })
    } catch (e) {
      this.setData({ usersLoading: false })
    }
  },

  shareApp() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  },

  // ── 俱乐部 ──────────────────────────────────────────────────────
  async _loadClubs(keyword = '') {
    this.setData({ clubsLoading: true })
    try {
      const api = require('../../utils/cloud')
      const res = await api.social.listClubs({ keyword, limit: 20 })
      this.setData({ clubs: res.clubs || [], clubsLoading: false })
    } catch (e) {
      this.setData({ clubsLoading: false })
    }
  },

  onClubSearch(e) {
    const keyword = e.detail.value
    this.setData({ clubKeyword: keyword })
    clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => this._loadClubs(keyword), 400)
  },

  async toggleJoin(e) {
    const { id, index } = e.currentTarget.dataset
    const club = this.data.clubs[index]
    const api = require('../../utils/cloud')
    try {
      if (club.isJoined) {
        await api.social.leaveClub({ clubId: id })
      } else {
        await api.social.joinClub({ clubId: id })
      }
      const clubs = [...this.data.clubs]
      const delta = club.isJoined ? -1 : 1
      clubs[index] = { ...club, isJoined: !club.isJoined, memberCount: club.memberCount + delta }
      this.setData({ clubs })
    } catch (e) {
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  openCreateClub() {
    this.setData({ showCreateClub: true, newClubName: this.data.clubKeyword || '', newClubCity: '' })
  },
  closeCreateClub() { this.setData({ showCreateClub: false }) },
  inputNewClubName(e) { this.setData({ newClubName: e.detail.value }) },
  inputNewClubCity(e) { this.setData({ newClubCity: e.detail.value }) },

  async submitCreateClub() {
    if (this.data.creatingClub) return
    const name = this.data.newClubName.trim()
    const city = this.data.newClubCity.trim()
    if (!name) { wx.showToast({ title: '请输入名称', icon: 'none' }); return }
    if (name.length < 2 || name.length > 30) { wx.showToast({ title: '名称需 2-30 字', icon: 'none' }); return }
    this.setData({ creatingClub: true })
    try {
      const api = require('../../utils/cloud')
      const res = await api.social.createClub({ name, city })
      await this._loadClubs(this.data.clubKeyword)
      this.setData({ showCreateClub: false, creatingClub: false })
      wx.showToast({ title: '俱乐部已创建', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || '创建失败，请重试', icon: 'none' })
      this.setData({ creatingClub: false })
    }
  },

  noop() {},
})
