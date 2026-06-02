// 云函数：init
// 一次性数据库初始化 + 历史训练记录回填 social_feed。
// 使用方法：在微信开发者工具右键此函数 → 上传并部署 → 云函数：在云端测试 → 运行
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTIONS = [
  'users', 'training_records', 'user_goals',
  'follows', 'social_feed', 'notifications',
  'feed_likes', 'clubs', 'club_members',
]

exports.main = async () => {
  // ── 1. 建集合 ───────────────────────────────────────────────────
  const collResults = {}
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      collResults[name] = '✅ created'
    } catch (e) {
      const msg = String(e.message || '')
      const isExist = e.errCode === -502005
        || e.errCode === -501001
        || msg.includes('already exists')
        || msg.includes('Table exist')
      collResults[name] = isExist ? '⏭ already exists' : `❌ ${e.message}`
    }
  }

  // ── 2. 回填 social_feed（补全历史训练记录） ──────────────────────
  // 拉取所有训练记录（云函数有管理员权限，不受 openid 限制）
  const recordsRes = await db.collection('training_records')
    .orderBy('ts', 'desc')
    .limit(200)
    .get()

  let backfilled = 0, skipped = 0

  for (const r of recordsRes.data) {
    // 检查 social_feed 里有没有对应条目
    const existing = await db.collection('social_feed')
      .where({ recordId: r._id })
      .count()

    if (existing.total > 0) { skipped++; continue }

    // 查用户是否属于俱乐部（用于 sourceType）
    let sourceType = ''
    try {
      const uRes = await db.collection('users')
        .where({ _openid: r._openid })
        .field({ clubId: true })
        .get()
      if (uRes.data[0] && uRes.data[0].clubId) sourceType = 'club'
    } catch (e) {}

    await db.collection('social_feed').add({
      data: {
        _openid:     r._openid,
        recordId:    r._id,
        ts:          r.ts || r.createdAt || Date.now(),
        bowType:     r.bowType     || '',
        distance:    r.distance    || '',
        totalScore:  r.totalScore  || 0,
        totalArrows: r.totalArrows || 0,
        mode:        r.mode        || 'ranking',
        note:        r.note        || '',
        likes:       0,
        sourceType,
        createdAt:   db.serverDate(),
      },
    })
    backfilled++
  }

  const result = {
    code: 0,
    collections: collResults,
    backfill: { total: recordsRes.data.length, backfilled, skipped },
  }
  console.log('init result:', JSON.stringify(result, null, 2))
  return result
}
