const CATEGORY_OPTIONS = [
  '反曲弓男子', '反曲弓女子', '复合弓公开组',
  '反曲弓U18', '10m气弓', '传统弓公开组',
]

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    safeBottom: 0,
    submitting: false,
    categoryOptions: CATEGORY_OPTIONS,

    form: {
      name: '', cover: '', organizer: '', location: '', address: '',
      startDate: '', endDate: '', regStart: '', regEnd: '',
      maxParticipants: '', fee: '', feeDesc: '',
      categories: [],
      contactName: '', contactPhone: '', pdfName: '',
    },
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
      safeBottom: app.globalData.safeBottom || 0,
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  chooseCover() {
    // 赛事系统未上线，封面图选择功能暂时禁用，避免微信隐私协议要求填写"选中的照片或视频"
    // 上线时恢复以下逻辑：
    // wx.chooseMedia({
    //   count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
    //   success: res => {
    //     this.setData({ 'form.cover': res.tempFiles[0].tempFilePath })
    //   },
    // })
    wx.showToast({ title: '功能暂未开放', icon: 'none' })
  },

  pickDate(e) {
    const key = e.currentTarget.dataset.key
    wx.showActionSheet({
      itemList: ['今天', '明天', '后天', '手动选择'],
      success: res => {
        if (res.tapIndex < 3) {
          const d = new Date(Date.now() + res.tapIndex * 86400000)
          const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          this.setData({ [`form.${key}`]: val })
        }
      },
    })
  },

  toggleCategory(e) {
    const cat = e.currentTarget.dataset.cat
    const cats = [...this.data.form.categories]
    const idx = cats.indexOf(cat)
    if (idx === -1) cats.push(cat)
    else cats.splice(idx, 1)
    this.setData({ 'form.categories': cats })
  },

  choosePdf() {
    wx.showToast({ title: '文件上传功能开发中', icon: 'none' })
  },

  async submitForm() {
    const { form } = this.data
    if (!form.name || !form.organizer || !form.location || !form.startDate || !form.regEnd || !form.fee || !form.contactName || !form.contactPhone) {
      wx.showToast({ title: '请填写必填项', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const api = require('../../utils/cloud')
      await api.event.create({
        title:              form.name,
        organizer:          form.organizer,
        location:           form.location,
        address:            form.address,
        startDate:          form.startDate,
        endDate:            form.endDate || form.startDate,
        regStartDate:       form.regStart,
        regDeadline:        form.regEnd,
        maxParticipants:    form.maxParticipants ? Number(form.maxParticipants) : null,
        fee:                Number(form.fee) || 0,
        feeDescription:     form.feeDesc,
        categories:         form.categories,
        contactName:        form.contactName,
        contactPhone:       form.contactPhone,
        status:             'registration_open',
      })
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (e) {
      console.warn('create event failed', e)
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
