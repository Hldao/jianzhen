const { handleErr } = require('../../utils/error')

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    safeBottom: 0,

    distOptions: ['18m', '30m', '50m', '70m'],
    bowOptions: ['反曲弓', '复合弓', '传统弓', '光弓'],

    goalDist: '70m',
    goalBow: '反曲弓',
    goalScore: '',
    goalDeadline: '',

    showPreview: false,
    previewText: '',
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
      safeBottom: app.globalData.safeBottom || 0,
    })
    this._loadExisting()
  },

  _loadExisting() {
    const saved = wx.getStorageSync('training_goal')
    if (saved) {
      this.setData({
        goalDist: saved.dist || '70m',
        goalBow: saved.bow || '反曲弓',
        goalScore: saved.score ? String(saved.score) : '',
        goalDeadline: saved.deadline || '',
      })
      this._updatePreview()
    }
  },

  pickDist(e) {
    this.setData({ goalDist: e.currentTarget.dataset.val })
    this._updatePreview()
  },

  pickBow(e) {
    this.setData({ goalBow: e.currentTarget.dataset.val })
    this._updatePreview()
  },

  inputScore(e) {
    this.setData({ goalScore: e.detail.value })
    this._updatePreview()
  },

  pickDeadline(e) {
    this.setData({ goalDeadline: e.detail.value })
    this._updatePreview()
  },

  _updatePreview() {
    const { goalDist, goalBow, goalScore, goalDeadline } = this.data
    if (!goalScore || !goalDeadline) {
      this.setData({ showPreview: false })
      return
    }
    const text = `在 ${goalDeadline} 前，完成 ${goalDist} ${goalBow} ${goalScore} 环`
    this.setData({ showPreview: true, previewText: text })
  },

  async saveGoal() {
    const { goalDist, goalBow, goalScore, goalDeadline } = this.data
    if (!goalScore) {
      wx.showToast({ title: '请输入目标环数', icon: 'none' })
      return
    }
    if (!goalDeadline) {
      wx.showToast({ title: '请选择截止日期', icon: 'none' })
      return
    }
    const goal = {
      dist: goalDist,
      bow: goalBow,
      score: Number(goalScore),
      deadline: goalDeadline,
      savedAt: Date.now(),
    }
    wx.setStorageSync('training_goal', goal)
    try {
      const api = require('../../utils/cloud')
      await api.goal.set({
        distance: goal.dist,
        bowType: goal.bow,
        targetScore: goal.score,
        deadline: goal.deadline,
      })
    } catch (e) {
      handleErr('goal.save', e)
      wx.showToast({ title: '云端同步失败，本地已保存', icon: 'none', duration: 2000 })
      setTimeout(() => wx.navigateBack(), 2200)
      return
    }
    wx.showToast({ title: '目标已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1200)
  },

  goBack() {
    wx.navigateBack()
  },

  onShareAppMessage() {
    return getApp().defaultShare()
  },
})
