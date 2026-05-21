Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    safeBottom: 0,

    avatarUrl: '',
    nickName: '',
    city: '',
    bowOptions: ['反曲弓', '复合弓', '传统弓', '光弓'],
    distOptions: ['10m', '18m', '30m', '50m', '70m'],
    bowType: '反曲弓',
    trainDist: '70m',
    club: '',
    clubId: '',

    clubs: [],
    filteredClubs: [],
    clubKeyword: '',
    showClubSheet: false,

    // 创建俱乐部
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
      safeBottom: app.globalData.safeBottom || 0,
    })
    this._loadProfile()
    this._loadClubs()
  },

  async _loadProfile() {
    try {
      const api = require('../../utils/cloud')
      const res = await api.user.getProfile()
      const u = res.user || {}
      this.setData({
        avatarUrl: u.avatarUrl || '',
        nickName: u.nickName || '',
        city: u.city || '',
        bowType: u.bowType || '反曲弓',
        trainDist: u.trainDist || '70m',
        club: u.club || '',
        clubId: u.clubId || '',
      })
    } catch (e) {
      const app = getApp()
      const cached = app.globalData.userInfo
      if (cached) {
        this.setData({
          avatarUrl: cached.avatarUrl || '',
          nickName: cached.nickName || '',
          city: cached.city || '',
          bowType: cached.bowType || '反曲弓',
          trainDist: cached.trainDist || '70m',
          club: cached.club || '',
          clubId: cached.clubId || '',
        })
      }
    }
  },

  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl })
  },

  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  async _loadClubs() {
    try {
      const api = require('../../utils/cloud')
      const res = await api.social.listClubs()
      const clubs = res.clubs || []
      this.setData({ clubs, filteredClubs: clubs })
    } catch (e) {
      console.warn('loadClubs failed', e)
    }
  },

  inputNick(e) { this.setData({ nickName: e.detail.value }) },
  inputCity(e) { this.setData({ city: e.detail.value }) },

  pickBow(e) { this.setData({ bowType: e.currentTarget.dataset.val }) },
  pickDist(e) { this.setData({ trainDist: e.currentTarget.dataset.val }) },

  openClubPicker() { this.setData({ showClubSheet: true, clubKeyword: '', filteredClubs: this.data.clubs }) },
  closeClubPicker() { this.setData({ showClubSheet: false }) },

  searchClub(e) {
    const kw = e.detail.value.trim()
    const filtered = kw
      ? this.data.clubs.filter(c => c.name.includes(kw))
      : this.data.clubs
    this.setData({ clubKeyword: kw, filteredClubs: filtered })
  },

  async selectClub(e) {
    const { name, id } = e.currentTarget.dataset
    const oldId = this.data.clubId
    this.setData({ club: name, clubId: id, showClubSheet: false })
    try {
      const api = require('../../utils/cloud')
      if (oldId && oldId !== id) await api.social.leaveClub({ clubId: oldId })
      await api.social.joinClub({ clubId: id })
    } catch (err) {
      console.warn('joinClub failed', err)
    }
  },

  async clearClub() {
    const id = this.data.clubId
    this.setData({ club: '', clubId: '' })
    if (!id) return
    try {
      const api = require('../../utils/cloud')
      await api.social.leaveClub({ clubId: id })
    } catch (err) {
      console.warn('leaveClub failed', err)
    }
  },

  openCreateClub() {
    this.setData({
      showCreateClub: true,
      newClubName: this.data.clubKeyword || '',
      newClubCity: '',
    })
  },
  closeCreateClub() { this.setData({ showCreateClub: false }) },
  inputNewClubName(e) { this.setData({ newClubName: e.detail.value }) },
  inputNewClubCity(e) { this.setData({ newClubCity: e.detail.value }) },

  async submitCreateClub() {
    if (this.data.creatingClub) return
    const name = this.data.newClubName.trim()
    const city = this.data.newClubCity.trim()
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    if (name.length < 2 || name.length > 30) {
      wx.showToast({ title: '名称需 2-30 字', icon: 'none' })
      return
    }
    this.setData({ creatingClub: true })
    try {
      const api = require('../../utils/cloud')
      const res = await api.social.createClub({ name, city })
      if (res.code !== 0) {
        wx.showToast({ title: res.msg || '创建失败', icon: 'none' })
        this.setData({ creatingClub: false })
        return
      }
      await this._loadClubs()
      this.setData({
        club: name,
        clubId: res.clubId || '',
        showCreateClub: false,
        showClubSheet: false,
        creatingClub: false,
      })
      wx.showToast({ title: '俱乐部已创建', icon: 'success' })
    } catch (e) {
      console.warn('createClub failed', e)
      wx.showToast({ title: '网络错误，请重试', icon: 'none' })
      this.setData({ creatingClub: false })
    }
  },

  async saveProfile() {
    if (this._saving) return
    const { nickName, city, bowType, trainDist, club } = this.data
    let avatarUrl = this.data.avatarUrl
    if (!nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    this._saving = true
    wx.showLoading({ title: '保存中…', mask: true })

    // 本地临时头像 → 上传到云存储，得到 cloud:// 永久路径
    if (avatarUrl && !avatarUrl.startsWith('cloud://') && !avatarUrl.startsWith('http')) {
      try {
        const ext = (avatarUrl.match(/\.([a-zA-Z]+)(?:\?|$)/) || [, 'jpg'])[1]
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: avatarUrl })
        avatarUrl = up.fileID
      } catch (e) {
        console.warn('avatar upload failed', e)
        wx.hideLoading()
        wx.showToast({ title: '头像上传失败，请重试', icon: 'none' })
        this._saving = false
        return
      }
    }

    const { clubId } = this.data
    const profile = { avatarUrl, nickName: nickName.trim(), city, bowType, trainDist, club, clubId }
    const app = getApp()
    app.globalData.userInfo = { ...app.globalData.userInfo, ...profile }
    try {
      const api = require('../../utils/cloud')
      await api.user.updateProfile(profile)
    } catch (e) {
      console.warn('updateProfile failed', e)
    }
    wx.hideLoading()
    this._saving = false
    this.setData({ avatarUrl })
    wx.showToast({ title: '资料已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1200)
  },

  goBack() {
    wx.navigateBack()
  },
})
