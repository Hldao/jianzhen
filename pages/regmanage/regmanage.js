const TABS = [
  { key: 'all',       label: '全部' },
  { key: 'pending',   label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'cancelled', label: '已取消' },
]

const STATUS_MAP = {
  pending:   { label: '待确认', cls: 'pending' },
  confirmed: { label: '已确认', cls: 'confirmed' },
  cancelled: { label: '已取消', cls: 'cancelled' },
}

function mapReg(r) {
  const st = STATUS_MAP[r.status] || STATUS_MAP.pending
  const d = new Date(r.createdAt || Date.now())
  return {
    ...r,
    statusLabel: st.label,
    statusCls:   st.cls,
    regTime: `${d.getMonth()+1}月${d.getDate()}日`,
    fee: r.fee || 0,
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,

    tabs: TABS,
    activeTab: 'all',
    currentTabLabel: '全部',

    loading: true,
    allList: [],
    list: [],
    pendingCount: 0,

    eventId: null,
  },

  onLoad(options) {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
      eventId: options.eventId || null,
    })
    this._load()
  },

  goBack() {
    wx.navigateBack()
  },

  async _load() {
    this.setData({ loading: true })
    try {
      const api = require('../../utils/cloud')
      const res = await api.event.getRegistrations({ eventId: this.data.eventId })
      const all = (res.registrations || []).map(mapReg)
      const pendingCount = all.filter(r => r.status === 'pending').length
      this.setData({ allList: all, pendingCount, loading: false })
      this._applyFilter(this.data.activeTab)
    } catch (e) {
      console.warn('load registrations failed', e)
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    const label = TABS.find(t => t.key === tab)?.label || '全部'
    this.setData({ activeTab: tab, currentTabLabel: label })
    this._applyFilter(tab)
  },

  _applyFilter(tab) {
    const { allList } = this.data
    const list = tab === 'all' ? allList : allList.filter(r => r.status === tab)
    this.setData({ list })
  },

  async confirmReg(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认报名',
      content: '确定接受该报名吗？',
      confirmText: '确认',
      success: async res => {
        if (!res.confirm) return
        try {
          const api = require('../../utils/cloud')
          await api.event.updateRegistration({ id, status: 'confirmed' })
          this._updateLocalStatus(id, 'confirmed')
          wx.showToast({ title: '已确认', icon: 'success' })
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      },
    })
  },

  async rejectReg(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '拒绝报名',
      content: '确定拒绝该报名吗？',
      confirmText: '拒绝',
      confirmColor: '#EF4444',
      success: async res => {
        if (!res.confirm) return
        try {
          const api = require('../../utils/cloud')
          await api.event.updateRegistration({ id, status: 'cancelled' })
          this._updateLocalStatus(id, 'cancelled')
          wx.showToast({ title: '已拒绝', icon: 'none' })
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      },
    })
  },

  _updateLocalStatus(id, status) {
    const allList = this.data.allList.map(r =>
      r._id === id ? { ...r, ...STATUS_MAP[status], status, statusCls: STATUS_MAP[status].cls, statusLabel: STATUS_MAP[status].label } : r
    )
    const pendingCount = allList.filter(r => r.status === 'pending').length
    this.setData({ allList, pendingCount })
    this._applyFilter(this.data.activeTab)
  },

  callPhone(e) {
    const phone = e.currentTarget.dataset.phone
    if (!phone) { wx.showToast({ title: '暂无联系电话', icon: 'none' }); return }
    wx.makePhoneCall({ phoneNumber: phone })
  },

  loadMore() {},
})
