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
// 云函数有管理员权限，where().remove() 可删除该 openid 名下全部匹配记录。
// 性能/完整性约定：
//   1) 各俱乐部 memberCount 递减 与 多集合删除均走 Promise.all 并发
//   2) removeAll 循环兜底 .remove() 单次上限，重度用户也能删干净
//   3) 训练照片 + 头像云存储文件随之清空，满足"全部数据删除"合规要求
async function deleteAccount(openid) {
  // Step 1：递减该用户加入的所有俱乐部 memberCount（并发）
  const mem = await db.collection('club_members').where({ _openid: openid }).get()
  await Promise.all(
    mem.data
      .filter(m => m.clubId)
      .map(m => db.collection('clubs').doc(m.clubId)
        .update({ data: { memberCount: _.inc(-1) } })
        .catch(e => console.warn('[deleteAccount] dec memberCount fail:', m.clubId, e && e.message)))
  )

  // Step 2：收集该用户在云存储里的全部文件路径（删库前先采集）
  const fileList = await collectUserFiles(openid)

  // Step 3：并发删 6 个业务集合，每个内部循环兜底 5000 上限
  await Promise.all([
    removeAll('club_members',     { _openid: openid }),
    removeAll('feed_likes',       { _openid: openid }),
    removeAll('follows',          { _openid: openid }),
    removeAll('user_goals',       { _openid: openid }),
    removeAll('social_feed',      { _openid: openid }),
    removeAll('training_records', { _openid: openid }),
  ])

  // Step 4：最后删账号资料本身
  await db.collection('users').where({ _openid: openid }).remove()

  // Step 5：批量删云存储文件（cloud.deleteFile 单次最多 50 个）
  await deleteCloudFiles(fileList)

  return { code: 0 }
}

// 循环删除：处理云函数侧 .remove() 单次 5000 条上限
async function removeAll(name, where) {
  let total = 0
  while (true) {
    const res = await db.collection(name).where(where).remove()
    const removed = (res.stats && res.stats.removed) || 0
    total += removed
    if (removed === 0) break
  }
  return total
}

// 收集该用户在云存储中的全部文件路径：训练照片 + 头像
async function collectUserFiles(openid) {
  const list = []
  const PAGE = 1000
  let skip = 0
  while (true) {
    const res = await db.collection('training_records')
      .where({ _openid: openid })
      .field({ medias: true })
      .skip(skip).limit(PAGE)
      .get()
    for (const r of res.data) {
      if (Array.isArray(r.medias)) {
        for (const f of r.medias) {
          if (typeof f === 'string' && f.indexOf('cloud://') === 0) list.push(f)
        }
      }
    }
    if (res.data.length < PAGE) break
    skip += PAGE
  }
  const userRes = await db.collection('users')
    .where({ _openid: openid })
    .field({ avatarUrl: true })
    .get()
  for (const u of userRes.data) {
    if (typeof u.avatarUrl === 'string' && u.avatarUrl.indexOf('cloud://') === 0) {
      list.push(u.avatarUrl)
    }
  }
  return list
}

// 批量删云存储文件（cloud.deleteFile 单次最多 50 个，分批）
async function deleteCloudFiles(fileList) {
  if (!fileList.length) return
  for (let i = 0; i < fileList.length; i += 50) {
    const batch = fileList.slice(i, i + 50)
    await cloud.deleteFile({ fileList: batch })
      .catch(e => console.warn('[deleteAccount] deleteFile batch fail:', e && e.message))
  }
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
