// 云函数：goal
// 负责：获取/设置训练目标，并计算当前进度
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action }  = event

  switch (action) {
    case 'get':      return getGoal(OPENID)
    case 'set':      return setGoal(OPENID, event.data)
    case 'delete':   return deleteGoal(OPENID)
    default:         return { code: 400, msg: 'unknown action' }
  }
}

// ── 获取目标 + 计算当前最高分和进度 ──────────────────────────────
async function getGoal(openid) {
  const goalRes = await db.collection('user_goals')
    .where({ _openid: openid })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()

  if (!goalRes.data.length) return { code: 0, goal: null }

  const goal = goalRes.data[0]
  const { distance, bowType, targetScore, deadline } = goal

  // 查同弓种 + 同距离的最高分
  const bestRes = await db.collection('training_records')
    .where({ _openid: openid, distance, bowType })
    .orderBy('totalScore', 'desc')
    .limit(1)
    .field({ totalScore: true, ts: true })
    .get()

  const best     = bestRes.data[0]?.totalScore ?? 0
  const pct      = targetScore > 0 ? Math.min(100, Math.round(best / targetScore * 100)) : 0
  const diff     = targetScore - best
  const daysLeft = Math.max(0, Math.ceil((new Date(deadline) - Date.now()) / 86400000))

  return {
    code: 0,
    goal: { ...goal, best, pct, diff, daysLeft, done: best >= targetScore },
  }
}

// ── 新增或更新目标（每个用户只有一条目标记录） ─────────────────────
async function setGoal(openid, data) {
  const { distance, bowType, targetScore, deadline } = data

  if (!distance || !bowType || !targetScore || !deadline) {
    return { code: 400, msg: '缺少必填字段' }
  }

  const existing = await db.collection('user_goals')
    .where({ _openid: openid })
    .limit(1)
    .get()

  if (existing.data.length > 0) {
    await db.collection('user_goals').doc(existing.data[0]._id).update({
      data: { distance, bowType, targetScore, deadline, updatedAt: db.serverDate() }
    })
    return { code: 0, _id: existing.data[0]._id }
  }

  const res = await db.collection('user_goals').add({
    data: {
      _openid: openid,
      distance,
      bowType,
      targetScore,
      deadline,
      updatedAt: db.serverDate(),
      createdAt: db.serverDate(),
    }
  })
  return { code: 0, _id: res._id }
}

// ── 删除目标 ───────────────────────────────────────────────────────
async function deleteGoal(openid) {
  await db.collection('user_goals').where({ _openid: openid }).remove()
  return { code: 0 }
}
