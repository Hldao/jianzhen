// 第一步：在微信开发者工具「云开发」面板新建环境，把环境 ID 填到下面
const CLOUD_ENV = 'cloudbase-d7g5lji2ae2803e6f'

App({
  onLaunch() {
    // ── 云开发初始化 ─────────────────────────────
    wx.cloud.init({
      env:           CLOUD_ENV,
      traceUser:     true,   // 在云开发控制台可追踪用户访问
    })

    // ── 导航栏高度计算 ───────────────────────────
    try {
      const info = wx.getSystemInfoSync()
      const btn  = wx.getMenuButtonBoundingClientRect()
      this.globalData.statusBarHeight = info.statusBarHeight
      this.globalData.navBarHeight    = btn.bottom + btn.top - 2 * info.statusBarHeight
      this.globalData.menuButton      = btn
    } catch (e) {
      this.globalData.statusBarHeight = 20
      this.globalData.navBarHeight    = 44
      this.globalData.menuButton      = null
    }

    // ── 登录 & 初始化用户数据 ────────────────────
    this._initUser()
  },

  // 登录流程：调用 user/login 云函数，写入 globalData
  async _initUser() {
    try {
      const api  = require('./utils/cloud')
      const res  = await api.user.login()
      this.globalData.userInfo = res.user

      // 首次登录：迁移本地历史数据到云端
      if (res.isNew) {
        const local = wx.getStorageSync('training_history') || []
        if (local.length > 0) {
          await api.training.migrate(local)
          wx.removeStorageSync('training_history')
        }
      }
    } catch (e) {
      console.error('用户初始化失败', e)
    }
  },

  globalData: {
    userInfo:        null,   // 当前用户信息（来自云数据库）
    statusBarHeight: 20,
    navBarHeight:    44,
    menuButton:      null,
    currentRecord:   null,   // 训练结束后暂存，供 detail 页读取
  },
})
