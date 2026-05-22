// 云函数：init
// 一次性数据库初始化，建好所有集合。
// 使用方法：在微信开发者工具右键此函数 → 上传并部署 → 云函数：在云端测试 → 运行
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 所有需要存在的集合
const COLLECTIONS = [
  'users',
  'training_records',
  'user_goals',
  'events',
  'event_registrations',
  'follows',
  'social_feed',
  'notifications',
  'feed_likes',
  'clubs',
  'club_members',
]

exports.main = async () => {
  const results = {}

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      results[name] = '✅ created'
    } catch (e) {
      // -502005 = 集合已存在，属于正常情况
      results[name] = (e.errCode === -502005 || String(e.message).includes('already exists'))
        ? '⏭ already exists'
        : `❌ error: ${e.message}`
    }
  }

  const allOk = Object.values(results).every(v => !v.startsWith('❌'))
  console.log('db-init result:', JSON.stringify(results, null, 2))
  return { code: allOk ? 0 : 1, results }
}
