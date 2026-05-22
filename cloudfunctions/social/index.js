// 云函数：social
// 负责：公开训练动态流、发现用户（俱乐部）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _  = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action }  = event

  switch (action) {
    case 'getPublicFeed':    return getPublicFeed(OPENID, event.opts)
    case 'getUnreadCount':   return getUnreadCount(OPENID)
    case 'getNotifications': return getNotifications(OPENID)
    case 'markAllRead':      return markAllRead(OPENID)
    case 'markRead':         return markRead(OPENID, event.id)
    case 'listUsers':        return listUsers(OPENID, event.opts)
    case 'listClubs':        return listClubs(OPENID, event.opts)
    case 'joinClub':         return joinClub(OPENID, event.clubId)
    case 'leaveClub':        return leaveClub(OPENID, event.clubId)
    case 'createClub':       return createClub(OPENID, event.data || {})
    case 'likePost':         return likePost(OPENID, event.feedId)
    case 'unlikePost':       return unlikePost(OPENID, event.feedId)
    case 'getUserProfile':   return getUserProfile(OPENID, event.targetOpenid)
    case 'getClubDetail':    return getClubDetail(OPENID, event.clubId)
    default:                 return { code: 400, msg: 'unknown action' }
  }
}

// ── 公开训练动态流 ─────────────────────────────────────────────────
// 返回所有用户（含自己）的最新训练记录，按时间倒序
async function getPublicFeed(openid, opts = {}) {
  const { limit = 20, skip = 0 } = opts

  const feedRes = await db.collection('social_feed')
    .orderBy('ts', 'desc')
    .skip(skip)
    .limit(limit)
    .get()

  if (!feedRes.data.length) {
    return { code: 0, feed: [], hasMore: false }
  }

  // 批量拉取用户昵称（去重）+ 当前用户点赞状态
  const feedIds   = feedRes.data.map(f => f._id)
  const uniqueIds = [...new Set(feedRes.data.map(f => f._openid))]

  const [usersRes, likedRes] = await Promise.all([
    db.collection('users')
      .where({ _openid: _.in(uniqueIds) })
      .field({ _openid: true, nickName: true, avatarUrl: true })
      .get(),
    feedIds.length > 0
      ? db.collection('feed_likes')
          .where({ _openid: openid, feedId: _.in(feedIds) })
          .field({ feedId: true })
          .get()
      : Promise.resolve({ data: [] }),
  ])

  const userMap  = {}
  for (const u of usersRes.data) userMap[u._openid] = u
  const likedSet = new Set(likedRes.data.map(l => l.feedId))

  const feed = feedRes.data.map(item => ({
    ...item,
    openid: item._openid,   // 供前端 data-openid 绑定（不含下划线更安全）
    isMine: item._openid === openid,
    liked:  likedSet.has(item._id),
    likes:  item.likes || 0,
    user:   userMap[item._openid] ?? { nickName: '箭证用户', avatarUrl: '' },
  }))

  return { code: 0, feed, hasMore: feed.length === limit }
}

// ── 未读通知数（赛事报名等系统通知用） ────────────────────────────
async function getUnreadCount(openid) {
  const res = await db.collection('notifications')
    .where({ _openid: openid, read: false })
    .count()
  return { code: 0, count: res.total }
}

// ── 通知列表 ──────────────────────────────────────────────────────
async function getNotifications(openid) {
  const res = await db.collection('notifications')
    .where({ _openid: openid })
    .orderBy('ts', 'desc')
    .limit(50)
    .get()
  return { code: 0, list: res.data }
}

// ── 全部标记已读 ──────────────────────────────────────────────────
async function markAllRead(openid) {
  await db.collection('notifications')
    .where({ _openid: openid, read: false })
    .update({ data: { read: true } })
  return { code: 0 }
}

// ── 单条标记已读 ──────────────────────────────────────────────────
async function markRead(openid, id) {
  if (!id) return { code: 0 }
  await db.collection('notifications').doc(id).update({ data: { read: true } })
  return { code: 0 }
}

// ── 发现用户：返回最近活跃的其他用户及其训练统计 ──────────────────
async function listUsers(openid, opts = {}) {
  const { limit = 30 } = opts

  const res = await db.collection('users')
    .where({ _openid: _.neq(openid) })
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .field({ _openid: true, nickName: true, avatarUrl: true, sessionCount: true })
    .get()

  const users = res.data.map(u => ({
    openid:       u._openid,
    nickName:     u.nickName || '箭证用户',
    avatarUrl:    u.avatarUrl || '',
    sessionCount: u.sessionCount || 0,
  }))

  return { code: 0, users }
}

// ── 俱乐部列表 ─────────────────────────────────────────────────────
async function listClubs(openid, opts = {}) {
  const { keyword = '', limit = 20, skip = 0 } = opts

  let query = db.collection('clubs')
  if (keyword) {
    query = query.where({ name: db.RegExp({ regexp: keyword, options: 'i' }) })
  }

  const res = await query
    .orderBy('memberCount', 'desc')
    .skip(skip)
    .limit(limit)
    .get()

  const clubIds = res.data.map(c => c._id)
  let joinedSet = new Set()
  if (clubIds.length > 0) {
    const memberRes = await db.collection('club_members')
      .where({ _openid: openid, clubId: _.in(clubIds) })
      .field({ clubId: true })
      .get()
    for (const m of memberRes.data) joinedSet.add(m.clubId)
  }

  const clubs = res.data.map(c => ({ ...c, isJoined: joinedSet.has(c._id) }))
  return { code: 0, clubs }
}

// ── 加入俱乐部 ─────────────────────────────────────────────────────
async function joinClub(openid, clubId) {
  const exist = await db.collection('club_members')
    .where({ _openid: openid, clubId })
    .count()
  if (exist.total > 0) return { code: 0 }

  await Promise.all([
    db.collection('club_members').add({
      data: { _openid: openid, clubId, joinedAt: db.serverDate() }
    }),
    db.collection('clubs').doc(clubId).update({
      data: { memberCount: _.inc(1) }
    }),
  ])
  return { code: 0 }
}

// ── 创建俱乐部 ─────────────────────────────────────────────────────
async function createClub(openid, data) {
  const name = String(data.name || '').trim()
  const city = String(data.city || '').trim()

  if (!name) return { code: 1, msg: '请输入俱乐部名称' }
  if (name.length < 2 || name.length > 30) return { code: 1, msg: '名称需 2-30 字' }

  const dup = await db.collection('clubs').where({ name }).limit(1).get()
  if (dup.data.length > 0) return { code: 1, msg: '已有同名俱乐部，请直接选择' }

  const now = db.serverDate()
  const addRes = await db.collection('clubs').add({
    data: {
      name, city,
      creatorOpenid: openid,
      memberCount: 1,
      createdAt: now,
    },
  })

  await db.collection('club_members').add({
    data: { _openid: openid, clubId: addRes._id, joinedAt: now },
  })

  return { code: 0, clubId: addRes._id, name }
}

// ── 退出俱乐部 ─────────────────────────────────────────────────────
async function leaveClub(openid, clubId) {
  const res = await db.collection('club_members')
    .where({ _openid: openid, clubId })
    .get()
  if (!res.data.length) return { code: 0 }

  await Promise.all([
    db.collection('club_members').doc(res.data[0]._id).remove(),
    db.collection('clubs').doc(clubId).update({
      data: { memberCount: _.inc(-1) }
    }),
  ])
  return { code: 0 }
}

// ── 点赞 ──────────────────────────────────────────────────────────
async function likePost(openid, feedId) {
  if (!feedId) return { code: 400, msg: 'feedId required' }
  const exist = await db.collection('feed_likes')
    .where({ _openid: openid, feedId })
    .count()
  if (exist.total > 0) return { code: 0 }  // 已点赞，幂等

  await Promise.all([
    db.collection('feed_likes').add({
      data: { _openid: openid, feedId, ts: db.serverDate() },
    }),
    db.collection('social_feed').doc(feedId).update({
      data: { likes: _.inc(1) },
    }),
  ])
  return { code: 0 }
}

// ── 取消点赞 ──────────────────────────────────────────────────────
async function unlikePost(openid, feedId) {
  if (!feedId) return { code: 400, msg: 'feedId required' }
  const res = await db.collection('feed_likes')
    .where({ _openid: openid, feedId })
    .get()
  if (!res.data.length) return { code: 0 }  // 未点赞，幂等

  await Promise.all([
    db.collection('feed_likes').doc(res.data[0]._id).remove(),
    db.collection('social_feed').doc(feedId).update({
      data: { likes: _.inc(-1) },
    }),
  ])
  return { code: 0 }
}

// ── 查看他人公开主页 ───────────────────────────────────────────────
async function getUserProfile(openid, targetOpenid) {
  if (!targetOpenid) return { code: 400, msg: 'targetOpenid required' }

  const [userRes, countRes] = await Promise.all([
    db.collection('users')
      .where({ _openid: targetOpenid })
      .field({ nickName: true, avatarUrl: true, bowType: true, trainDist: true, club: true })
      .get(),
    db.collection('training_records').where({ _openid: targetOpenid }).count(),
  ])

  if (!userRes.data.length) return { code: 404, msg: '用户不存在' }
  const u = userRes.data[0]

  const feedRes = await db.collection('social_feed')
    .where({ _openid: targetOpenid })
    .orderBy('ts', 'desc')
    .limit(5)
    .get()

  return {
    code: 0,
    isSelf: openid === targetOpenid,
    user: {
      openid:    targetOpenid,
      nickName:  u.nickName  || '箭证用户',
      avatarUrl: u.avatarUrl || '',
      bowType:   u.bowType   || '',
      trainDist: u.trainDist || '',
      club:      u.club      || '',
    },
    totalSessions: countRes.total,
    recentFeed: feedRes.data,
  }
}

// ── 俱乐部详情 ────────────────────────────────────────────────────
async function getClubDetail(openid, clubId) {
  if (!clubId) return { code: 400, msg: 'clubId required' }

  const [clubRes, membersRes, joinedRes] = await Promise.all([
    db.collection('clubs').doc(clubId).get(),
    db.collection('club_members')
      .where({ clubId })
      .orderBy('joinedAt', 'asc')
      .limit(30)
      .get(),
    db.collection('club_members').where({ _openid: openid, clubId }).count(),
  ])

  const club = clubRes.data
  const memberOpenids = membersRes.data.map(m => m._openid)
  let members = []

  if (memberOpenids.length > 0) {
    const usersRes = await db.collection('users')
      .where({ _openid: _.in(memberOpenids) })
      .field({ _openid: true, nickName: true, avatarUrl: true, bowType: true })
      .get()
    const userMap = {}
    for (const u of usersRes.data) userMap[u._openid] = u
    members = membersRes.data.map(m => ({
      openid:    m._openid,
      joinedAt:  m.joinedAt,
      nickName:  userMap[m._openid]?.nickName  || '箭证用户',
      avatarUrl: userMap[m._openid]?.avatarUrl || '',
      bowType:   userMap[m._openid]?.bowType   || '',
      isCreator: m._openid === club.creatorOpenid,
    }))
  }

  return {
    code: 0,
    club: {
      _id:         clubId,
      name:        club.name,
      city:        club.city        || '',
      memberCount: club.memberCount || 0,
      createdAt:   club.createdAt,
      isCreator:   club.creatorOpenid === openid,
    },
    members,
    isJoined:  joinedRes.total > 0,
  }
}
