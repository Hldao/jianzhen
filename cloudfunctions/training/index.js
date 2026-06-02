// 云函数：training
// 负责：保存训练记录、查询列表、获取单条、删除
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db    = cloud.database()
const _     = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action }  = event
  try {
    return await dispatch(OPENID, action, event)
  } catch (e) {
    console.error('[training] action=' + action + ' failed:', e)
    return { code: 500, msg: String(e && e.message || e), stack: String(e && e.stack || '') }
  }
}

async function dispatch(OPENID, action, event) {
  switch (action) {
    case 'save':     return save(OPENID, event.record)
    case 'list':     return list(OPENID, event.opts)
    case 'getOne':   return getOne(OPENID, event.id)
    case 'delete':   return del(OPENID, event.id)
    case 'migrate':  return migrate(OPENID, event.records)
    default:         return { code: 400, msg: 'unknown action' }
  }
}

// ── 保存一条训练记录 ───────────────────────────────────────────────
// record 中不含 _id 时为新增，含 _id 时为更新备注等可编辑字段
async function save(openid, record = {}) {
  const { _id, ...data } = record

  // 计算均环/支（前端也可以传过来，这里服务端兜底计算）
  if (!data.avgPerArrow && data.totalArrows > 0) {
    data.avgPerArrow = Math.round(data.totalScore / data.totalArrows * 10) / 10
  }

  if (_id) {
    // 鉴权：只能改自己的记录
    const existing = await db.collection('training_records').doc(_id).get()
    if (!existing.data || existing.data._openid !== openid) {
      return { code: 403, msg: '无权限' }
    }
    // 只允许更新 note 字段（其他是记录本身不应被篡改）
    await db.collection('training_records').doc(_id).update({
      data: { note: data.note ?? '' }
    })
    // 同步更新 social_feed 里的备注
    await db.collection('social_feed')
      .where({ recordId: _id, _openid: openid })
      .update({ data: { note: data.note ?? '' } })
    return { code: 0, _id }
  }

  const res = await db.collection('training_records').add({
    data: {
      ...data,
      _openid:   openid,
      ts:        data.ts || Date.now(),
      createdAt: db.serverDate(),
    }
  })

  // 查询用户所属俱乐部，用于动态标签
  const userRes = await db.collection('users')
    .where({ _openid: openid })
    .field({ clubId: true })
    .get()
  const sourceType = (userRes.data[0] && userRes.data[0].clubId) ? 'club' : ''

  // 向 social_feed 写入一条动态，供箭友看到
  await db.collection('social_feed').add({
    data: {
      _openid:    openid,
      recordId:   res._id,
      ts:         data.ts || Date.now(),
      bowType:    data.bowType,
      distance:   data.distance,
      totalScore: data.totalScore,
      totalArrows:data.totalArrows,
      mode:       data.mode,
      note:       data.note ?? '',
      likes:      0,
      sourceType,
      createdAt:  db.serverDate(),
    }
  })

  return { code: 0, _id: res._id }
}

// ── 查询当前用户的训练记录列表 ────────────────────────────────────
async function list(openid, opts = {}) {
  const { limit = 50, skip = 0, distance, bowType } = opts

  let query = db.collection('training_records').where({
    _openid: openid,
    ...(distance ? { distance } : {}),
    ...(bowType  ? { bowType  } : {}),
  })

  const [countRes, dataRes] = await Promise.all([
    query.count(),
    query.orderBy('ts', 'desc').skip(skip).limit(limit).get(),
  ])

  return { code: 0, total: countRes.total, records: dataRes.data }
}

// ── 获取单条记录详情 ───────────────────────────────────────────────
async function getOne(openid, id) {
  const res = await db.collection('training_records').doc(id).get()
  // 鉴权：只能查自己的
  if (res.data._openid !== openid) return { code: 403, msg: '无权限' }
  return { code: 0, record: res.data }
}

// ── 删除训练记录 ───────────────────────────────────────────────────
async function del(openid, id) {
  const res = await db.collection('training_records').doc(id).get()
  if (res.data._openid !== openid) return { code: 403, msg: '无权限' }

  await db.collection('training_records').doc(id).remove()
  // 同步删除动态
  await db.collection('social_feed').where({ recordId: id }).remove()
  return { code: 0 }
}

// ── 迁移本地历史数据（一次性调用） ──────────────────────────────────
// 把 wx.getStorageSync('training_history') 的数组批量写入云端
// 幂等：先按 ts 查云端已存在的记录，避免用户重复触发导致翻倍
async function migrate(openid, records) {
  if (!Array.isArray(records) || records.length === 0) return { code: 0, count: 0 }

  const tsList = records.map(r => r.id).filter(Boolean)
  let existingTs = new Set()
  if (tsList.length > 0) {
    const existing = await db.collection('training_records')
      .where({ _openid: openid, ts: _.in(tsList) })
      .field({ ts: true })
      .get()
    existingTs = new Set(existing.data.map(d => d.ts))
  }

  const fresh = records.filter(r => !existingTs.has(r.id))
  if (fresh.length === 0) return { code: 0, count: 0, skipped: records.length }

  const tasks = fresh.map(r => {
    const { id, ...rest } = r
    return db.collection('training_records').add({
      data: { ...rest, _openid: openid, ts: id, createdAt: db.serverDate() }
    })
  })
  await Promise.all(tasks)
  return { code: 0, count: fresh.length, skipped: records.length - fresh.length }
}
