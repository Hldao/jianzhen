// 云函数：events
// 负责：赛事列表/详情、报名/取消报名、我的报名
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _  = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action }  = event

  switch (action) {
    case 'list':       return list(OPENID, event.filters)
    case 'getOne':     return getOne(OPENID, event.id)
    case 'register':   return register(OPENID, event.data)
    case 'cancelReg':  return cancelReg(OPENID, event.regId)
    case 'myRegs':     return myRegs(OPENID)
    case 'create':     return createEvent(OPENID, event.data)   // 赛事方使用
    case 'updateStatus': return updateStatus(OPENID, event.id, event.status)
    default:           return { code: 400, msg: 'unknown action' }
  }
}

// ── 赛事列表（带筛选） ─────────────────────────────────────────────
// status 筛选: 'all' | 'registration_open' | 'upcoming' | 'ended'
async function list(openid, filters = {}) {
  const { status = 'all', keyword = '', limit = 20, skip = 0 } = filters

  let where = {}
  if (status !== 'all') {
    if (status === 'registration_open') where.status = 'registration_open'
    else if (status === 'upcoming')     where.status = _.in(['registration_open', 'registration_closed'])
    else if (status === 'ended')        where.status = 'ended'
    else if (status === 'full')         where.status = 'full'
  }

  const dataRes = await db.collection('events')
    .where(where)
    .orderBy('startTimestamp', 'asc')
    .skip(skip)
    .limit(limit)
    .field({
      title: true, organizer: true, location: true,
      startDate: true, endDate: true, regEnd: true,
      fee: true, maxParticipants: true, currentParticipants: true,
      status: true, featured: true, categories: true,
    })
    .get()

  // 附加当前用户的报名状态
  const eventIds = dataRes.data.map(e => e._id)
  let myStatusMap = {}
  if (eventIds.length > 0) {
    const regRes = await db.collection('event_registrations')
      .where({ _openid: openid, eventId: _.in(eventIds) })
      .field({ eventId: true, status: true })
      .get()
    for (const r of regRes.data) {
      myStatusMap[r.eventId] = r.status
    }
  }

  const events = dataRes.data.map(e => ({
    ...e,
    myStatus: myStatusMap[e._id] || 'none',
  }))

  return { code: 0, events }
}

// ── 赛事详情（包含完整信息） ────────────────────────────────────────
async function getOne(openid, id) {
  const res = await db.collection('events').doc(id).get()
  const ev = res.data

  // 查当前用户的报名记录
  const regRes = await db.collection('event_registrations')
    .where({ _openid: openid, eventId: id })
    .limit(1)
    .get()

  return {
    code:     0,
    event:    ev,
    myReg:    regRes.data[0] ?? null,
  }
}

// ── 报名赛事 ───────────────────────────────────────────────────────
async function register(openid, data) {
  const { eventId, category, realName, phone, idType, idNumber, club } = data

  // 检查是否已报名
  const existRes = await db.collection('event_registrations')
    .where({ _openid: openid, eventId, status: _.neq('cancelled') })
    .count()
  if (existRes.total > 0) return { code: 409, msg: '已报名该赛事' }

  // 检查赛事状态和名额
  const evRes = await db.collection('events').doc(eventId).get()
  const ev = evRes.data
  if (ev.status !== 'registration_open') return { code: 400, msg: '当前赛事不在报名期' }
  if (ev.currentParticipants >= ev.maxParticipants) return { code: 400, msg: '报名人数已满' }

  // 原子增加参与人数并写入报名记录
  const [regRes] = await Promise.all([
    db.collection('event_registrations').add({
      data: {
        _openid: openid,
        eventId,
        eventTitle: ev.title,
        category,
        realName,
        phone,
        idType:   idType || 'id_card',
        idNumber: idNumber || '',
        club:     club || '',
        fee:      ev.fee,
        status:   'pending',          // 待审核
        participantNumber: '',         // 审核通过后由主办方填写
        createdAt: db.serverDate(),
      }
    }),
    db.collection('events').doc(eventId).update({
      data: { currentParticipants: _.inc(1) }
    }),
  ])

  // 给用户发一条通知
  await db.collection('notifications').add({
    data: {
      _openid:   openid,
      type:      'event',
      title:     '报名提交成功',
      desc:      `《${ev.title}》报名已提交，等待主办方审核。`,
      read:      false,
      relatedId: regRes._id,
      createdAt: db.serverDate(),
    }
  })

  return { code: 0, regId: regRes._id }
}

// ── 取消报名 ───────────────────────────────────────────────────────
async function cancelReg(openid, regId) {
  const regRes = await db.collection('event_registrations').doc(regId).get()
  const reg = regRes.data

  if (reg._openid !== openid) return { code: 403, msg: '无权限' }
  if (reg.status === 'cancelled') return { code: 400, msg: '已取消' }

  await Promise.all([
    db.collection('event_registrations').doc(regId).update({
      data: { status: 'cancelled', cancelledAt: db.serverDate() }
    }),
    db.collection('events').doc(reg.eventId).update({
      data: { currentParticipants: db.command.inc(-1) }
    }),
  ])

  return { code: 0 }
}

// ── 我的报名列表 ───────────────────────────────────────────────────
async function myRegs(openid) {
  const res = await db.collection('event_registrations')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get()

  return { code: 0, regs: res.data }
}

// ── 创建赛事（赛事方使用） ─────────────────────────────────────────
async function createEvent(openid, data) {
  // 检查用户是否有赛事方权限
  const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (!userRes.data[0]?.isOrganizer) return { code: 403, msg: '需要赛事方身份' }

  const res = await db.collection('events').add({
    data: {
      ...data,
      _openid:             openid,
      currentParticipants: 0,
      status:              'registration_open',
      createdAt:           db.serverDate(),
    }
  })

  return { code: 0, _id: res._id }
}

// ── 更新赛事状态（赛事方使用） ────────────────────────────────────
async function updateStatus(openid, eventId, status) {
  const ev = await db.collection('events').doc(eventId).get()
  if (ev.data._openid !== openid) return { code: 403, msg: '非赛事创建者' }

  const allowed = ['registration_open', 'registration_closed', 'full', 'ended']
  if (!allowed.includes(status)) return { code: 400, msg: '无效的状态值' }

  await db.collection('events').doc(eventId).update({ data: { status } })
  return { code: 0 }
}
