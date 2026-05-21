Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath:   '/pages/index/index',
        text:       '首页',
        icon:       '/assets/icons/tab-home.svg',
        activeIcon: '/assets/icons/tab-home-active.svg',
      },
      {
        pagePath:   '/pages/data/data',
        text:       '数据',
        icon:       '/assets/icons/tab-data.svg',
        activeIcon: '/assets/icons/tab-data-active.svg',
      },
      {
        pagePath:   '/pages/mine/mine',
        text:       '我的',
        icon:       '/assets/icons/tab-mine.svg',
        activeIcon: '/assets/icons/tab-mine-active.svg',
      },
    ],
  },
  methods: {
    switchTab(e) {
      const { path, index } = e.currentTarget.dataset
      this.setData({ selected: index })
      wx.switchTab({ url: path })
    },
  },
})
