const PAGE_SIZE = 20

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    activeTab: 'users',

    users: [],
    usersLoading: true,
    usersLoadingMore: false,
    usersSkip: 0,
    usersHasMore: true,

    clubs: [],
    clubsLoading: true,
    clubsLoadingMore: false,
    clubsSkip: 0,
    clubsHasMore: true,
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

  // ── 箭友列表 · 分页上滑加载 ─────────────────────────────────────
  async _loadUsers(append = false) {
    if (append) {
      if (this.data.usersLoadingMore || !this.data.usersHasMore) return
      this.setData({ usersLoadingMore: true })
    } else {
      this.setData({ usersLoading: true, usersSkip: 0, usersHasMore: true })
    }
    try {
      const api = require('../../utils/cloud')
      const skip = append ? this.data.usersSkip : 0
      const res = await api.social.listUsers({ limit: PAGE_SIZE, skip })
      const newUsers = res.users || []
      this.setData({
        users: append ? this.data.users.concat(newUsers) : newUsers,
        usersSkip: (append ? this.data.usersSkip : 0) + newUsers.length,
        usersHasMore: newUsers.length >= PAGE_SIZE,
        usersLoading: false,
        usersLoadingMore: false,
      })
    } catch (e) {
      this.setData({ usersLoading: false, usersLoadingMore: false })
    }
  },

  shareApp() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  },

  // ── 俱乐部 · 分页上滑加载 ────────────────────────────────────────
  async _loadClubs(keyword = this.data.clubKeyword, append = false) {
    if (append) {
      if (this.data.clubsLoadingMore || !this.data.clubsHasMore) return
      this.setData({ clubsLoadingMore: true })
    } else {
      this.setData({ clubsLoading: true, clubsSkip: 0, clubsHasMore: true })
    }
    try {
      const api = require('../../utils/cloud')
      const skip = append ? this.data.clubsSkip : 0
      const res = await api.social.listClubs({ keyword, limit: PAGE_SIZE, skip })
      const newClubs = res.clubs || []
      this.setData({
        clubs: append ? this.data.clubs.concat(newClubs) : newClubs,
        clubsSkip: (append ? this.data.clubsSkip : 0) + newClubs.length,
        clubsHasMore: newClubs.length >= PAGE_SIZE,
        clubsLoading: false,
        clubsLoadingMore: false,
      })
    } catch (e) {
      this.setData({ clubsLoading: false, clubsLoadingMore: false })
    }
  },

  // ── 上滑加载更多（根据当前 Tab 决定加载哪个）────────────────────
  onScrollToLower() {
    if (this.data.activeTab === 'users') this._loadUsers(true)
    else this._loadClubs(this.data.clubKeyword, true)
  },

  onClubSearch(e) {
    const keyword = e.detail.value
    this.setData({ clubKeyword: keyword })
    clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => this._loadClubs(keyword), 400)
  },

  async toggleJoin(e) {
    const { id, index } = e.currentTarget.dataset
    if (this._joiningId) return
    const club = this.data.clubs[index]
    if (!club) return
    this._joiningId = id
    const api = require('../../utils/cloud')
    try {
      if (club.isJoined) {
        await api.social.leaveClub({ clubId: id })
      } else {
        await api.social.joinClub({ clubId: id })
      }
      const clubs = [...this.data.clubs]
      const delta = club.isJoined ? -1 : 1
      clubs[index] = { ...club, isJoined: !club.isJoined, memberCount: (club.memberCount || 0) + delta }
      this.setData({ clubs })
    } catch (err) {
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    } finally {
      this._joiningId = null
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

  goUserProfile(e) {
    const { openid } = e.currentTarget.dataset
    if (openid) wx.navigateTo({ url: `/pages/userprofile/userprofile?openid=${openid}` })
  },

  goClubDetail(e) {
    const { id } = e.currentTarget.dataset
    if (id) wx.navigateTo({ url: `/pages/clubdetail/clubdetail?id=${id}` })
  },

  noop() {},
})
