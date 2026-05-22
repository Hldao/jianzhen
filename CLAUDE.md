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
│   └── cloud.js                    # 统一 API 封装（所有页面通过此文件调云函数）
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
| 消息通知 | `pages/notification/notification` | 系统通知列表，支持标记已读 |

### 赛事系统（待上线，代码已写，UI 已注释）

| 页面 | 路径 | 状态 |
|------|------|------|
| 赛事列表 | `pages/events/events` | 已实现，等赛事系统上线后启用 |
| 我的报名 | `pages/myevents/myevents` | 已实现，mine 页面入口已注释 |
| 发布赛事 | `pages/publisher/publisher` | 赛事方发布页 |
| 创建赛事 | `pages/createevent/createevent` | 赛事方创建表单 |
| 报名管理 | `pages/regmanage/regmanage` | 赛事方报名管理 |

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
| `getStats` | 获取统计：totalSessions/bestScore/eventCount |

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
| `getPublicFeed` | 所有用户训练动态流（含用户头像/昵称） |
| `getUnreadCount` | 未读通知数 |
| `getNotifications` | 通知列表 |
| `markAllRead` / `markRead` | 标记已读 |
| `listUsers` | 发现箭友列表 |
| `listClubs` | 俱乐部列表（含 isJoined 状态） |
| `joinClub` | 加入俱乐部（写 club_members，memberCount+1） |
| `leaveClub` | 退出俱乐部（删 club_members，memberCount-1） |
| `createClub` | 创建俱乐部（名称去重，自动加入） |

### `events` 云函数（待上线）

赛事发布、报名、取消报名、状态管理等，代码已完整实现。

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
| `events` | 赛事信息 |
| `event_registrations` | 报名记录 |
| `social_feed` | 公开训练动态 |
| `notifications` | 系统通知 |
| `clubs` | 俱乐部信息（name/city/memberCount/creatorOpenid） |
| `club_members` | 俱乐部成员关系（openid + clubId） |
| `follows` | 关注关系（暂未启用） |

---

## 训练模式

training.js 支持三种模式：

| 模式 | mode 值 | 说明 |
|------|---------|------|
| 积分赛 | `ranking` | 标准积分赛，支持定时（每组 / 每支箭计时） |
| 淘汰赛 | `elimination` | WA 奥运淘汰赛规则：每组 3 支箭，按 set point 制，先到 6 分胜 |
| 自由练习 | `custom` | 自定义箭数/组数/时间 |

### 淘汰赛虚拟对手
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

---

## 当前开发状态（2026-05-22）

### 已完成 ✅
- 完整训练录入流程（积分赛/淘汰赛/自由练习）
- 虚拟对手淘汰赛（基于历史记录的正态分布模型）
- 训练数据统计页（周/月图表）
- 训练详情 + 分享朋友圈卡片（canvas 生成）
- 训练详情智能分析（7 条动态规则：精准度/脱靶/体力曲线/稳定性/最佳组/完美组/淘汰赛结果）
- 训练参数记忆：开始训练页自动还原上次选项
- 成就系统（5 个成就，2 列网格折叠，点击查看解锁时间和要求）
- 微信原生头像/昵称获取（type="nickname"），头像云存储
- 箭友动态流（含用户头像同步，点击自己的记录可进入详情）
- 俱乐部：创建/搜索/加入/退出（profile 页 + 发现页双入口功能完整对齐）
- 我的页面：等级/连续天数/所属俱乐部徽章/成就/菜单
- 首页动态点赞（乐观更新，catchtap 防止冒泡到详情跳转）

### 等待上线 ⏳（代码已写，入口已注释）
- 赛事系统（发布/报名/报名管理）
  - 恢复方式：取消 mine.wxml 中"我的报名"的注释，tabs 里加回 events tab

### 待开发 📋
- 俱乐部详情页（成员列表、管理功能）
- 用户详情页（查看他人主页）
- 社交关注 / 点赞功能（`follows` 集合已建）
- 赛事系统正式上线

---

## Git 工作流建议

```
main          — 稳定可演示版本
feature/xxx   — 功能开发分支
```

1. 开始新功能前：`git pull origin main`
2. 功能完成后：commit → push → merge to main
3. 两个账号同时开发时：各用独立 feature 分支，避免直接改 main
