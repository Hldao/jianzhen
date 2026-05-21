function formatDate(dateStr) {
  if (!dateStr) return { month: '', day: '' }
  const d = new Date(dateStr)
  return {
    month: `${d.getMonth() + 1}月`,
    day:   String(d.getDate()),
    date:  `${d.getMonth() + 1}月${d.getDate()}日`,
  }
}

function statusInfo(status) {
  const map = {
    registration_open:   { label: '报名中',   cls: 'open' },
    registration_closed: { label: '即将截止', cls: 'soon' },
    full:                { label: '已满员',   cls: 'full' },
    ended:               { label: '已结束',   cls: 'full' },
  }
  return map[status] || { label: '报名中', cls: 'open' }
}

function formatCount(current, max) {
  if (!max) return `${current || 0} 人报名`
  return `${current || 0}/${max} 人`
}

function mapEvent(e) {
  const { month, day, date } = formatDate(e.startDate)
  const { label, cls } = statusInfo(e.status)
  return {
    ...e,
    id:          e._id,
    name:        e.title,
    month, day, date,
    address:     e.location || '',
    format:      (e.categories || []).join(' · ') || '',
    count:       e.currentParticipants || 0,
    countLabel:  formatCount(e.currentParticipants, e.maxParticipants),
    statusLabel: label,
    statusCls:   cls,
  }
}

function sortList(list, sortBy) {
  const copy = [...list]
  if (sortBy === 'date') {
    copy.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
  } else {
    copy.sort((a, b) => b.count - a.count)
  }
  return copy
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,

    loading: true,
    refreshing: false,
    searchKeyword: '',

    featured: null,
    allEvents: [],
    competitions: [],
    sortBy: 'date',
  },

  onLoad() {
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 2 })
    }
    this._load()
  },

  async _load(isRefresh = false) {
    if (!isRefresh) this.setData({ loading: true })

    try {
      const api = require('../../utils/cloud')
      const res = await api.event.list({ status: 'all', limit: 30 })
      const all = (res.events || []).map(mapEvent)

      const featuredRaw = all.find(e => e.featured) || null
      const listItems = featuredRaw
        ? all.filter(e => e._id !== featuredRaw._id)
        : all

      this.setData({
        featured:    featuredRaw,
        allEvents:   listItems,
        competitions: sortList(listItems, this.data.sortBy),
        loading:     false,
        refreshing:  false,
      })
    } catch (e) {
      console.warn('events load failed', e)
      this.setData({ loading: false, refreshing: false })
    }
  },

  onRefresh() {
    this.setData({ refreshing: true })
    this._load(true)
  },

  setSortBy(e) {
    const sortBy = e.currentTarget.dataset.sort
    if (sortBy === this.data.sortBy) return
    this.setData({ sortBy })
    this._applyFilter(this.data.searchKeyword, sortBy)
  },

  onSearch(e) {
    const kw = e.detail.value.trim()
    this.setData({ searchKeyword: kw })
    this._applyFilter(kw, this.data.sortBy)
  },

  clearSearch() {
    this.setData({ searchKeyword: '' })
    this._applyFilter('', this.data.sortBy)
  },

  _applyFilter(kw, sortBy) {
    let list = this.data.allEvents
    if (kw) {
      const k = kw.toLowerCase()
      list = list.filter(e =>
        e.name.toLowerCase().includes(k) || (e.address || '').toLowerCase().includes(k)
      )
    }
    this.setData({ competitions: sortList(list, sortBy) })
  },

  openCompDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/events/detail?id=${id}` })
  },

  openFeaturedDetail() {
    if (!this.data.featured) return
    wx.navigateTo({ url: `/pages/events/detail?id=${this.data.featured._id}` })
  },
})
