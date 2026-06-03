// utils/error.js
// 统一错误处理：标准化 console 日志格式，可选自动 toast
//
// 用法：
//   const { handleErr } = require('../../utils/error')
//   try { ... } catch (e) { handleErr('profile.loadClubs', e) }
//   try { ... } catch (e) { handleErr('profile.joinClub', e, '加入失败，请重试') }
//
// 设计要点：
// - scope 用「页面.方法」点号命名，便于聚合搜索
// - 优先取 e.message，回落 e.errMsg / String(e)
// - cloud.js 抛出的 Error 带 code，自动拼到日志里

function handleErr(scope, e, toastMsg) {
  const code = e && e.code
  const msg  = (e && (e.message || e.errMsg)) || String(e)
  console.warn(`[${scope}]${code ? ' code=' + code : ''} ${msg}`, e)
  if (toastMsg) {
    wx.showToast({ title: toastMsg, icon: 'none', duration: 2000 })
  }
}

module.exports = { handleErr }
