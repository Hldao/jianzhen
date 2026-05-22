// utils/cloud.js
// 统一封装所有云函数调用，页面直接 import 使用
// 用法：const api = require('../../utils/cloud')
//       const { user } = await api.user.login()

function call(fnName, action, params = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: fnName,
      data: { action, ...params },
      success: res => {
        const result = res.result
        if (result.code === 0) {
          resolve(result)
        } else {
          const err = new Error(result.msg || '请求失败')
          err.code = result.code
          reject(err)
        }
      },
      fail: err => reject(err),
    })
  })
}

// ── 用户 ──────────────────────────────────────────────────────────
const user = {
  login:          ()       => call('user', 'login'),
  getProfile:     ()       => call('user', 'getProfile'),
  updateProfile:  (data)   => call('user', 'updateProfile', { data }),
  getStats:       ()       => call('user', 'getStats'),
}

// ── 训练记录 ──────────────────────────────────────────────────────
const training = {
  // 保存一条记录（record 不含 _id = 新增，含 _id = 更新备注）
  save:     (record) => call('training', 'save',   { record }),
  // 获取列表，可选过滤 { distance, bowType, limit, skip }
  list:     (opts)   => call('training', 'list',   { opts }),
  // 获取单条详情
  getOne:   (id)     => call('training', 'getOne', { id }),
  // 删除
  delete:   (id)     => call('training', 'delete', { id }),
  // 本地数据迁移到云端（一次性）
  migrate:  (records)=> call('training', 'migrate', { records }),
}

// ── 赛事 ──────────────────────────────────────────────────────────
const event = {
  // 列表，filters: { status, keyword, limit, skip }
  list:                (filters) => call('events', 'list',               { filters }),
  // 单条详情
  getOne:              (id)      => call('events', 'getOne',             { id }),
  // 报名，data: { eventId, category, realName, phone, idType, idNumber, club }
  register:            (data)    => call('events', 'register',           { data }),
  // 取消报名
  cancelReg:           (regId)   => call('events', 'cancelReg',         { regId }),
  // 我的报名列表
  getMyRegistrations:  ()        => call('events', 'myRegs'),
  // 创建赛事（赛事方）
  create:              (data)    => call('events', 'create',             { data }),
  // 更新赛事状态（赛事方）
  updateStatus:        (id, s)   => call('events', 'updateStatus',      { id, status: s }),
}

// ── 训练目标 ──────────────────────────────────────────────────────
const goal = {
  // 获取目标（含最高分、进度百分比）
  get:    ()     => call('goal', 'get'),
  // 设置/更新目标，data: { distance, bowType, targetScore, deadline }
  set:    (data) => call('goal', 'set', { data }),
  // 删除目标
  delete: ()     => call('goal', 'delete'),
}

// ── 社交 ──────────────────────────────────────────────────────────
const social = {
  // 所有人的公开训练动态流
  getPublicFeed:    (opts) => call('social', 'getPublicFeed',    { opts }),
  // 通知
  getUnreadCount:   ()     => call('social', 'getUnreadCount'),
  getNotifications: ()     => call('social', 'getNotifications'),
  markAllRead:      ()     => call('social', 'markAllRead'),
  markRead:         (data) => call('social', 'markRead',         data),
  // 发现用户
  listUsers:        (opts) => call('social', 'listUsers',        { opts }),
  // 俱乐部
  listClubs:        (opts)   => call('social', 'listClubs',   { opts }),
  joinClub:         (data)   => call('social', 'joinClub',    data),
  leaveClub:        (data)   => call('social', 'leaveClub',   data),
  createClub:       (data)   => call('social', 'createClub',  { data }),
  // 点赞
  likePost:         (feedId) => call('social', 'likePost',          { feedId }),
  unlikePost:       (feedId) => call('social', 'unlikePost',        { feedId }),
  // 用户主页 / 俱乐部详情
  getUserProfile:   (opts)   => call('social', 'getUserProfile',    opts),
  getClubDetail:    (opts)   => call('social', 'getClubDetail',     opts),
}

module.exports = { user, training, event, goal, social }
