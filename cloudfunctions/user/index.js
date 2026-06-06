// 云函数：user
// 负责：登录、获取/更新个人资料、统计数据
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _  = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event
  try {
    return await dispatch(OPENID, action, event)
  } catch (e) {
    console.error('[user] action=' + action + ' failed:', e)
    return { code: 500, msg: String(e && e.message || e), stack: String(e && e.stack || '') }
  }
}

async function dispatch(OPENID, action, event) {
  switch (action) {
    case 'login':         return login(OPENID)
    case 'getProfile':    return getProfile(OPENID)
    case 'updateProfile': return updateProfile(OPENID, event.data)
    case 'getStats':      return getStats(OPENID)
    case 'deleteAccount': return deleteAccount(OPENID)
    default:              return { code: 400, msg: 'unknown action' }
  }
}

// ── 登录：首次创建用户文档，后续直接返回 ──────────────────────────
async function login(openid) {
  const col = db.collection('users')

  // 尝试读取已有用户
  const { data } = await col.where({ _openid: openid }).limit(1).get()

  if (data.length > 0) {
    return { code: 0, user: data[0], isNew: false }
  }

  // 首次登录：创建用户文档
  const res = await col.add({
    data: {
      _openid:      openid,
      nickName:     '箭证新人',
      avatarUrl:    '',
      phone:        '',
      bio:          '',
      clubId:       '',
      createdAt:    db.serverDate(),
    }
  })

  const newUser = { _id: res._id, _openid: openid, nickName: '箭证新人' }
  return { code: 0, user: newUser, isNew: true }
}

// ── 获取个人资料 ───────────────────────────────────────────────────
async function getProfile(openid) {
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (!data.length) return { code: 404, msg: '用户不存在' }
  return { code: 0, user: data[0] }
}

// ── 更新个人资料 ───────────────────────────────────────────────────
async function updateProfile(openid, updates) {
  // 只允许更新安全字段
  const allowed = ['nickName', 'avatarUrl', 'phone', 'bio', 'clubId', 'city', 'bowType', 'trainDist', 'club']
  const safe = {}
  for (const k of allowed) {
    if (updates[k] !== undefined) safe[k] = updates[k]
  }
  if (!Object.keys(safe).length) return { code: 400, msg: '没有可更新的字段' }

  await db.collection('users')
    .where({ _openid: openid })
    .update({ data: { ...safe, updatedAt: db.serverDate() } })

  return { code: 0 }
}

// ── 注销账号：永久删除该用户全部数据（不可恢复） ──────────────────
// 云函数有管理员权限，where().remove() 可删除该 openid 名下全部匹配记录
async function deleteAccount(openid) {
  // 1. 先退出所有俱乐部并修正人数（保持 clubs.memberCount 准确）
  const mem = await db.collection('club_members').where({ _openid: openid }).get()
  for (const m of mem.data) {
    if (m.clubId) {
      await db.collection('clubs').doc(m.clubId)
        .update({ data: { memberCount: _.inc(-1) } }).catch(() => {})
    }
  }
  // 2. 删除该用户在各集合的全部数据
  await db.collection('club_members').where({ _openid: openid }).remove()
  await db.collection('feed_likes').where({ _openid: openid }).remove()
  await db.collection('follows').where({ _openid: openid }).remove()
  await db.collection('user_goals').where({ _openid: openid }).remove()
  await db.collection('social_feed').where({ _openid: openid }).remove()
  await db.collection('training_records').where({ _openid: openid }).remove()
  // 3. 最后删账号资料本身
  await db.collection('users').where({ _openid: openid }).remove()
  return { code: 0 }
}

// ── 综合统计（训练次数、最高分、箭友数） ─────────────────────────
async function getStats(openid) {
  const [recRes, goalRes, followRes] = await Promise.all([
    db.collection('training_records').where({ _openid: openid }).count(),
    db.collection('user_goals').where({ _openid: openid }).limit(1).get(),
    db.collection('follows').where({ _openid: openid }).count(),
  ])

  // 找历史最高分
  const bestRes = await db.collection('training_records')
    .where({ _openid: openid })
    .orderBy('totalScore', 'desc')
    .limit(1)
    .field({ totalScore: true })
    .get()

  return {
    code: 0,
    totalSessions:  recRes.total,
    bestScore:      bestRes.data[0]?.totalScore ?? 0,
    friendCount:    followRes.total,
    goal:           goalRes.data[0] ?? null,
  }
}
