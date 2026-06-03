# 箭证 — Claude Code 项目文档

> 微信小程序，帮助射箭运动员记录训练、分析数据、连接箭友社区。
> 一句话定位：**用数据证明每一次进步**。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 微信小程序 (WXML / WXSS / JS，无 TypeScript，无 npm 框架) |
| 后端 | 微信云开发（云函数 + 云数据库 + 云存储） |
| 云环境 ID | `cloudbase-d7g5lji2ae2803e6f` |
| AppID | `wxc6c4f27a637bb1ac` |
| 基础库版本 | 3.4.3 |

---

## 项目结构

```
miniprogram-1/
├── app.js / app.json / app.wxss   # 全局配置
├── pages/                          # 所有页面（见下方页面清单）
├── cloudfunctions/                 # 云函数（见下方云函数清单）
├── custom-tab-bar/                 # 自定义 TabBar（3 个 Tab）
├── styles/
│   └── icons.wxss                  # 全局图标系统（LC 图标）
├── utils/
│   ├── cloud.js                    # 统一 API 封装（所有页面通过此文件调云函数）
│   ├── error.js                    # handleErr(scope, e, toastMsg?) 统一错误日志
│   └── training-helper.js          # 训练相关的纯 helper（SCORE_VAL/ARROW_CLS/SLOT_COLORS/calcOpponentLevel/randNormal/fmtSecs/fmtTimeLabel）
└── cloudfunctions/db-init.md       # 数据库集合 + 索引建立说明
```

---

## 页面清单

### Tab 页面（底部导航 3 个）

| Tab | 页面路径 | 功能 |
|-----|----------|------|
| 首页 | `pages/index/index` | 箭友动态流（公开训练记录）+ 快速开始训练入口 |
| 数据 | `pages/data/data` | 个人训练数据统计（周/月图表、最高分、训练频率） |
| 我的 | `pages/mine/mine` | 个人主页：头像/等级/连续天数/成就/功能菜单 |

### 训练核心

| 页面 | 路径 | 功能 |
|------|------|------|
| 训练 | `pages/training/training` | **核心页面**：训练流程、成绩录入、淘汰赛模式、成就触发 |
| 训练详情 | `pages/detail/detail` | 训练记录详情：每支箭明细、智能洞察、分享朋友圈卡片 |
| 历史记录 | `pages/history/history` | 训练历史列表，支持筛选 |

### 用户

| 页面 | 路径 | 功能 |
|------|------|------|
| 个人资料 | `pages/profile/profile` | 编辑头像（微信原生）、昵称、城市、弓种、常训距离、所属俱乐部 |
| 训练目标 | `pages/goal/goal` | 设置目标距离/环数/截止日期，显示进度 |

### 社交 / 社区

| 页面 | 路径 | 功能 |
|------|------|------|
| 发现箭友 | `pages/explore/explore` | Tab 切换：箭友列表 / 俱乐部列表（搜索、加入/退出、创建） |
| 用户主页 | `pages/userprofile/userprofile` | 查看他人公开主页（头像/等级/训练次数/最近动态） |
| 俱乐部详情 | `pages/clubdetail/clubdetail` | 俱乐部信息 + 成员列表，加入/退出功能 |
| 消息通知 | `pages/notification/notification` | 系统通知列表，支持标记已读 |

---

## 云函数清单

所有调用均通过 `utils/cloud.js` 封装，页面统一使用：
```js
const api = require('../../utils/cloud')
await api.user.getProfile()
await api.training.list({ limit: 60 })
await api.social.createClub({ name, city })
```

### `user` 云函数

| action | 说明 |
|--------|------|
| `login` | 登录 / 首次创建用户文档 |
| `getProfile` | 获取当前用户资料 |
| `updateProfile` | 更新资料（allowedFields: nickName/avatarUrl/city/bowType/trainDist/club/clubId） |
| `getStats` | 获取统计：totalSessions/bestScore/friendCount |

### `training` 云函数

| action | 说明 |
|--------|------|
| `save` | 保存训练记录，同步写 social_feed |
| `list` | 获取列表，支持 distance/bowType 过滤 |
| `getOne` | 获取单条详情 |
| `delete` | 删除记录，同步删 social_feed |
| `migrate` | 首次登录时迁移本地历史数据到云端 |

### `social` 云函数

| action | 说明 |
|--------|------|
| `getPublicFeed` | 所有用户训练动态流（含用户头像/昵称/点赞状态） |
| `getUnreadCount` | 未读通知数 |
| `getNotifications` | 通知列表 |
| `markAllRead` / `markRead` | 标记已读 |
| `likePost` | 点赞动态（幂等，写 feed_likes，social_feed.likes+1） |
| `unlikePost` | 取消点赞（幂等，删 feed_likes，social_feed.likes-1） |
| `listUsers` | 发现箭友列表 |
| `listClubs` | 俱乐部列表（含 isJoined 状态） |
| `joinClub` | 加入俱乐部（写 club_members，memberCount+1） |
| `leaveClub` | 退出俱乐部（删 club_members，memberCount-1） |
| `createClub` | 创建俱乐部（名称去重，自动加入） |
| `getUserProfile` | 查看他人公开主页（资料 + 训练次数 + 最近 5 条动态） |
| `getClubDetail` | 俱乐部详情（基本信息 + 成员列表 + isJoined 状态） |

### `init` 云函数（一次性运维工具）

在微信开发者工具「云函数 → 在云端测试」中手动触发，用途：
1. 创建全部数据库集合（已存在则跳过，幂等）
2. 将历史 `training_records` 回填到 `social_feed`（已有对应条目则跳过）

### `goal` 云函数

训练目标的增删改查。

---

## 数据库集合

详细字段 + 索引见 `cloudfunctions/db-init.md`。

| 集合 | 用途 |
|------|------|
| `users` | 用户资料 |
| `training_records` | 训练记录 |
| `user_goals` | 训练目标 |
| `social_feed` | 公开训练动态 |
| `notifications` | 系统通知 |
| `clubs` | 俱乐部信息（name/city/memberCount/creatorOpenid） |
| `club_members` | 俱乐部成员关系（openid + clubId） |
| `feed_likes` | 动态点赞记录（openid + feedId，去重用） |
| `follows` | 关注关系（暂未启用） |

---

## 训练模式

training.js 支持三种模式：

| 模式 | mode 值 | 说明 |
|------|---------|------|
| 积分赛 | `ranking` | 标准积分赛，支持定时（每组 / 每支箭计时） |
| 淘汰赛 | `elimination` | WA 奥运淘汰赛规则：每组 3 支箭，按 set point 制，先到 6 分胜 |
| 自由练习 | `custom` | 自定义箭数/组数/时间 |

### 淘汰赛虚拟对手（实现位于 `utils/training-helper.js`）
- `calcOpponentLevel(history, distance, bowLabel)` — 用历史记录（同距离+弓种，3箭组）拟合均值/标准差
- 历史不足 6 组时默认 mean=21, std=3
- `randNormal(mean, std)` — Box-Muller 变换生成正态分布随机对手得分
- 难度档位：让分（对手 -2）/ 正常 / 挑战（对手 +2）

### 靶纸颜色（WA 标准）
```js
const SLOT_COLORS = {
  'X': '#F5C518', '10': '#F5C518', '9': '#F5C518',  // 黄
  '8': '#E63946', '7': '#E63946',                   // 红
  '6': '#457B9D', '5': '#457B9D',                   // 蓝
  '4': '#1D1D1D', '3': '#1D1D1D',                   // 黑
  '2': '#F5F5F5', '1': '#F5F5F5',                   // 白
  'M': '#9CA3AF',                                    // 脱靶
}
```

---

## 成就系统

成就存储于 `wx.getStorageSync`，键名如下：

| 键名 | 结构 | 触发条件 |
|------|------|----------|
| `achievement_golden_end` | `{ earnedAt, count }` | 非淘汰赛，一组全部 ≥9 环且非完美（training.js 写入） |
| `achievement_perfect_end` | `{ earnedAt, count }` | 任意模式，一组全部 X 或 10（training.js 写入） |
| `achievement_first` | `{ earnedAt }` | 完成第一次训练（mine.js 写入） |
| `achievement_week` | `{ earnedAt }` | 连续训练 7 天（mine.js 写入） |
| `achievement_veteran` | `{ earnedAt }` | 累计训练 20 次（mine.js 写入） |
| `achievement_month` | `{ earnedAt }` | 连续训练 30 天（mine.js 写入） |

`mine.js` 中的 `buildAchievements(totalSessions, streak, goldenEndData, perfectEndData)` 使用 `readOrInit(key, condition, now)` 辅助函数：先读 Storage，不存在才写入，避免写后再读的冗余。

**展示的 5 个成就（2 列网格，可折叠）：**

| ID | 名称 | 解锁条件 |
|----|------|----------|
| `first` | 初心者 | 完成第一次训练 |
| `golden_end` | 收黄 | 一组全命中 9 环及以上（可重复，显示次数） |
| `perfect` | 完美一组 | 一组全 X/10 环（可重复，显示次数） |
| `veteran` | 勤奋射手 | 连续 7 天 **或** 累计 20 次（两条件任满其一） |
| `month` | 坚持30天 | 连续训练满 30 天 |

点击成就格子打开底部弹层，显示解锁时间和触发要求。

---

## 图标系统（LC Icons）

全局样式定义在 `styles/icons.wxss`。

**使用方式：**
```xml
<view class="lc lc-md lc-flame" style="background-color:#FF6B35;"></view>
```

**尺寸类：** `lc-xs`(24) / `lc-sm`(32) / `lc-md`(40) / `lc-lg`(56) / `lc-xl`(72) / `lc-2xl`(96)（单位 rpx）

**颜色类：** `lc-primary` / `lc-yellow` / `lc-green` / `lc-indigo` / `lc-red` / `lc-blue` / `lc-gray` / `lc-white`

**可用图标：** `lc-star` / `lc-sun` / `lc-crosshair` / `lc-flame` / `lc-snowflake` / `lc-zap` / `lc-bell` / `lc-lock` / `lc-user` / `lc-users` / `lc-medal` / `lc-share` / `lc-settings` / `lc-chevron-right` / `lc-circle-x` / `lc-x` / `lc-map-pin` / `lc-clock` / `lc-trending-up` / `lc-flag` / `lc-heart` / `lc-heart-solid` / `lc-search` / `lc-pencil` / `lc-arrow-up-right` / `lc-info` / `lc-coffee` / `lc-house`

---

## 设计系统 & CSS 变量

每个页面 `page {}` 声明相同的设计 token：

```css
--primary: #FF6B35;      /* 主色 橙色 */
--text: #1A1A2E;         /* 正文 */
--text-mid: #64748B;     /* 次要文字 */
--text-mid: #94A3B8;     /* 浅灰文字 */
--border: #E8ECF2;       /* 分割线 / 背景 */
--white: #fff;
--shadow: 0 4rpx 20rpx rgba(0,0,0,.07);
--radius: 28rpx;
background: #EEF1F8;     /* 页面背景 */
```

---

## 关键编码约定

### 1. 导航栏 + 滚动体布局（每个页面必须遵循）
```xml
<!-- 固定顶部导航 -->
<view class="navbar" style="padding-top:{{statusBarHeight}}px;">
  <view class="navbar-inner" style="height:{{navBarHeight}}px;">...</view>
</view>

<!-- 可滚动内容区，top 要减去导航高度 -->
<scroll-view scroll-y class="scroll-body"
  style="top:calc({{statusBarHeight}}px + {{navBarHeight}}px);">
  ...
  <view class="bottom-safe"></view>
</scroll-view>
```

### 2. 云函数调用
```js
const api = require('../../utils/cloud')
// cloud.js 内部：code=0 → resolve，其他 → reject(Error)
// 所有调用均 async/await + try/catch
const res = await api.user.getProfile()
```

### 3. 头像上传（微信原生流程）
```js
// 1. <button open-type="chooseAvatar"> 获取临时路径
// 2. wx.cloud.uploadFile 上传到 avatars/ 路径
// 3. 存储 cloud:// 永久路径到 users.avatarUrl
```

### 4. globalData 使用
```js
const app = getApp()
app.globalData.userInfo    // 当前用户信息（登录后写入）
app.globalData.currentRecord  // 训练完成后暂存，供 detail 页读取；detail 页 onUnload 时置 null
app.globalData.statusBarHeight
app.globalData.navBarHeight
```

### 5. 俱乐部成员一致性
`profile.js selectClub()` 选择新俱乐部时：先调 `leaveClub(旧 clubId)`，再调 `joinClub(新 clubId)`，确保 `club_members` 集合与 `users.club` 字段保持同步。`clearClub()` 同理先调 `leaveClub` 再清空本地数据。

### 6. 训练默认设置恢复
`training.js onLoad()` 读取 `wx.getStorageSync('training_last_settings')`，自动还原上次训练的弓种/距离/靶纸/模式/自定义参数/淘汰赛难度。`startTraining()` 第一行写入当次设置。

### 7. mine.js 加载性能
`_load()` 使用 `this._lastLoadTime` 做 60 秒防抖缓存，避免反复切 Tab 时重复发起 4 个并发云函数请求。训练记录拉取上限为 60 条（streak 计算足够）。

### 8. 弹层模态框规范
- `catchtap="noop"` 阻止内层卡片点击冒泡到外层遮罩关闭；`catchtap=""` **无效**（WeChat 要求传函数名）
- 弹层内 `<input>` 必须加 `adjust-position="{{false}}"` 阻止键盘把 `position: fixed` 弹层顶飞
- `noop() {}` 方法每个有弹层的 Page 都需声明

### 9. 首页白屏优化
`index.js _loadFeed()` 先读 `wx.getStorageSync('training_history')` 本地缓存渲染，再异步拉云端数据覆盖，消除冷启动白屏。

### 10. profileDirty 缓存失效
`profile.js` 保存资料成功后设 `app.globalData.profileDirty = true`，`mine.js _load()` 检查该标志，命中时强制刷新（跳过 60 秒缓存）。

### 11. 数据迁移幂等
`app.js _initUser()` 用 `wx.getStorageSync('migration_done')` 旗标 + 云函数 `training.migrate` 内部按 `ts` 去重，双保险防止用户重启后本地历史数据被重复写入云端。

### 12. 点赞互斥锁
`index.js toggleLike` 用 `this._likingIds: Set` 防止快速连点导致 like/unlike 交错；请求失败时回滚 UI 计数，保证 UI 与云端最终一致。

### 13. 通知徽章生命周期
首页 `onShow` 时 `wx.setTabBarBadge({index: 2})` 设徽章（挂在"我的"Tab），进入 `mine` 或 `notification` 页时 `wx.removeTabBarBadge({index: 2})` 清除；`notification.onShow` 同时调 `markAllRead` 标记云端已读。

### 14. 训练记录权限
`training.save` 更新分支（含 _id）必须先 `doc(_id).get()` 校验 `_openid === openid`，否则返回 403。`social_feed` 同步更新也要带 `_openid` 条件，防止改他人动态备注。

### 15. 云函数错误兜底
全部业务云函数（`user` / `training` / `social` / `goal`）统一用 dispatch + 顶层 try/catch 模式，异常包成 `{ code: 500, msg, stack }` 返回。前端 cloud.js 按 code 分流，错误直接 Console 可见，不会被静默吞掉。

### 16. 列表分页与 image lazy-load
所有可能产生 100+ 条目的列表都做了上滑分页（首页 feed / explore 箭友+俱乐部 / clubdetail 成员 / history 记录）。WXML 的 `<image>` 加 `lazy-load="{{true}}"`，仅渲染视口内头像。history 用 `displayRecords` 分批渲染模式（records 算 stats，displayRecords 渲列表）。

### 17. 5 分钟内存缓存
`userprofile` / `clubdetail` 使用 `globalData.userProfileCache` / `clubDetailCache` 做 5 分钟内存缓存，避免短时间内重复进出页面时反复请求云端。toggleJoin 同步更新缓存。

### 18. 首次启动引导授权
`app.js _initUser` 检测 `isNew || !nickName || !avatarUrl` + 未存过 `onboarding_done` 时设 `globalData.needOnboarding=true`，首页 onShow 弹层引导用户用 `<button open-type="chooseAvatar">` 和 `<input type="nickname">` 完成头像/昵称授权（微信新规要求用户主动触发，不能自动弹窗）。

### 19. 隐私协议涉及的接口边界
微信审核会扫描代码识别敏感接口。当前主流程涉及：
- `wx.saveImageToPhotosAlbum`（detail.js 分享卡保存到相册）→ 协议须写「相册（仅写入）」
- `open-type="chooseAvatar"` + `type="nickname"`（profile.wxml）→ 协议须写「微信昵称、头像」

---

## 当前开发状态（2026-06-03）

### 已完成 ✅
- 完整训练录入流程（积分赛/淘汰赛/自由练习）
- 虚拟对手淘汰赛（基于历史记录的正态分布模型，抢 6 分制规则）
- 训练数据统计页（周/月图表）
- 训练详情 + 分享朋友圈卡片（canvas 生成）
- 训练详情智能分析（7 条动态规则：精准度/脱靶/体力曲线/稳定性/最佳组/完美组/淘汰赛结果）
- 训练参数记忆：开始训练页自动还原上次选项
- 成就系统（5 个成就，2 列网格折叠，点击查看解锁时间和要求）
- 微信原生头像/昵称获取（type="nickname"），头像云存储
- 箭友动态流（含用户头像同步，点击自己的记录可进入详情）
- 首页动态点赞（乐观更新，catchtap 防止冒泡到详情跳转）
- 俱乐部：创建/搜索/加入/退出（profile 页 + 发现页双入口功能完整对齐，弹层 bug 已修）
- 我的页面：等级/连续天数/所属俱乐部徽章/成就/菜单
- 用户主页（他人公开资料 + 训练统计 + 最近动态）
- 俱乐部详情页（信息 + 成员列表 + 加入/退出）
- 微信隐私授权弹层（`__usePrivacyCheck__: true`，首次启动弹出）
- 首页冷启动白屏优化（本地缓存先渲染，云端数据后覆盖）
- 数据库一键初始化 `init` 云函数（建集合 + 历史记录回填 social_feed）
- 上线前体检：数据迁移幂等 / 点赞互斥锁 / 通知徽章清除 / 训练记录权限校验 / 长文本截断（5 处页面）
- **2026-06 优化轮次**（8 轮 commit）：
  - 云函数全量统一 dispatch + 顶层 try/catch（user/training/goal/social）
  - 列表分页：index feed / explore 箭友+俱乐部 / clubdetail 成员 / history 记录
  - history `displayRecords` 分批渲染模式（records 算 stats，displayRecords 渲列表）
  - WXML `<image>` 全面 `lazy-load`（feed/explore/clubdetail 头像）
  - userprofile + clubdetail 5 分钟内存缓存（globalData，toggleJoin 同步更新）
  - 首页 onShow 串行 await 改 `Promise.allSettled` 并行（首屏 ↓ ~1.5s）
  - 首次启动弹层引导授权头像/昵称（用 button + nickname input，符合微信新规）
  - 俱乐部切换失败 UI 回滚 + 多处 timer 退出清理（避免 setData on dead page）
  - 错误处理统一：抽 `utils/error.js` 暴露 `handleErr`，9 个页面 16 处 console.warn 全部统一
  - 抽 `utils/training-helper.js`：SCORE_VAL / ARROW_CLS / SLOT_COLORS / calcOpponentLevel / randNormal / fmtSecs / fmtTimeLabel

### 待开发 📋
- 社交关注功能（`follows` 集合已建，UI 未开发）

### 手动运维步骤（新环境首次部署）
1. 微信开发者工具上传并部署云函数：`user` / `training` / `social` / `goal` / `init`
2. 云端测试 `init` 函数（建集合 + 回填历史数据）
3. 在 mp.weixin.qq.com → 隐私 → 用户隐私保护指引 中填写隐私协议
4. 云数据库 → 对应集合建索引（参见 `cloudfunctions/db-init.md`）
   - **关键索引（性能强相关）**：`social_feed.ts desc`（首页公开流）、`club_members.clubId + joinedAt asc`（俱乐部成员列表）

---

## Git 工作流建议

```
main          — 稳定可演示版本
feature/xxx   — 功能开发分支
```

1. 开始新功能前：`git pull origin main`
2. 功能完成后：commit → push → merge to main
3. 两个账号同时开发时：各用独立 feature 分支，避免直接改 main
