# 箭证 · 项目进度快照

> 用途：下次切换回这个项目时，快速回忆「现在到哪一步、要做什么、关键账号在哪」。
> 技术细节请看 [CLAUDE.md](./CLAUDE.md)。

---

## 🎯 当前状态（2026-06-07）

**进度：v1.1.0 全部代码就绪 + 新增注销账号功能 + 首页 bug 修 + perf 优化，等待上传 + 提审。**

> 2026-06-07 协作补丁：邀请 [catsmao11](https://github.com/catsmao11) 加入 write 协作者，他推了 3 个 commit（修首页"刚训练完记录短暂消失"bug + 新增「注销账号」满足审核合规 + mine 菜单 UI 微调），之后 Claude 追加 1 个 perf commit（注销流程并发删 + 云存储清理 + 首页合并短路）。

| 维度 | 状态 |
|---|---|
| 代码 | ✅ 已 push 至 `Hldao/jianzhen` main（18 commit · 含猫猫协作 + perf 优化） |
| 隐私协议（mp 后台） | ✅ 5 条接口已配置 |
| 数据库索引 | ✅ 2 个关键索引已建 |
| 云函数部署 | ⚠️ training 已上传，**user（含 deleteAccount）待重新上传** |
| 云存储权限 | ✅ 默认即可（image src=cloud:// 不受限制） |
| 注销流程实测 | ⏳ 待你在开发者工具里跑一遍（参考下方步骤） |
| 微信开发者工具上传 | ⏳ 待操作 |
| mp 后台提交审核 | ⏳ 待操作 |

---

## ⏭ 下一步要做什么（按顺序）

```
1. 微信开发者工具 → 云函数 user 文件夹 → 右键「上传并部署：所有文件」
   (关键 · 包含新的 deleteAccount action · 不部署的话注销会报 unknown action)
2. 注销流程实测（避免审核驳回）：
   a. 注册新账号 → 修改昵称/头像 → 加 1-2 个俱乐部 → 训练 1 次 + 上传训练照
   b. 我的 → 注销账号 → 确认
   c. 云开发控制台验证：users / training_records / social_feed / club_members /
      feed_likes / user_goals / follows 都没有该 openid 的数据
   d. 云存储控制台验证：training-media/${recordId}/ 文件已删除
   e. clubs.memberCount 已正确递减
3. 微信开发者工具 → 右上角「上传」→ 版本号 1.1.0 → 提交
4. mp.weixin.qq.com → 版本管理 → 开发版本 → 找到 1.1.0 → 点「提交审核」
5. 填功能页面信息：首页选 /pages/index/index
6. 填测试账号：「无需测试账号，微信一键登录」
7. 等待审核（一般 1-3 个工作日）
8. 通过后 mp 后台 → 版本管理 → 「审核版本」点「发布」
```

### 审核驳回的话怎么办
- 大部分是隐私协议条目漏写或文案问题 → 看驳回原因，对照 CLAUDE.md §19 接口边界补
- 截图发出来对照修，5-10 分钟能搞定

---

## 📋 上线后下一阶段

按优先级排：

1. **社交关注功能** —— `follows` 集合已建好，UI 完全没做（CLAUDE.md 待开发区唯一一项）
2. **训练照片在动态流可见** —— 当前训练照片只在自己 detail 页显示，可考虑公开到 social_feed
3. **数据导出 / 备份** —— 部分老用户会问
4. **复合弓 / 传统弓的差异化模板** —— 当前所有弓种共用一套 UI

---

## 🔑 关键信息速查

| 项 | 值 |
|---|---|
| AppID | `wxc6c4f27a637bb1ac` |
| 云环境 ID | `cloudbase-d7g5lji2ae2803e6f` |
| GitHub | `Hldao/jianzhen` |
| 开发者微信号（公开在 about 页） | `l380855352` |
| 项目路径 | `/Users/dadao/WeChatProjects/miniprogram-1/` |
| 基础库版本 | 3.4.3 |

---

## 🧠 本次 session 关键决策（避免下次重复踩坑）

### 1. 分享按钮必须用 `<button open-type="share">`，不能用 `wx.showShareMenu`
`wx.showShareMenu` 只是让胶囊菜单的「转发」可用，按钮表面无反应。
view 容器要分享时，叠透明 button overlay：`.share-overlay-btn { position:absolute; inset:0; opacity:0 }`
+ `::after { border:none }` 去掉默认边框。

### 2. 每个 Page 必须声明 `onShareAppMessage`
否则右上角菜单的「转发」灰显。统一通过 `getApp().defaultShare(opts)` 调用，
detail/clubdetail/userprofile 自定义 title。index/mine 加 `onShareTimeline` 支持朋友圈。

### 3. 云存储权限不用付费升级
微信小程序 `<image src="cloud://...">` 渲染图片背后走 `wx.cloud.getTempFileURL`，
不受存储权限设置限制。默认「仅创建者可读写」对头像、训练照片完全够用。
只有 `wx.cloud.downloadFile` 才受限制（当前项目没用到）。

### 4. 训练照片 cloud function 部署后控制台时间不更新是缓存
真正验证方法是云端测试 `{"action":"updateMedias","recordId":"fake-id","medias":[]}`：
- 返回 `doc... does not exist` → 新版已部署
- 返回 `unknown action` → 还是旧版

### 5. 反馈通道用 `button open-type="feedback"` 走微信官方
审核员喜欢看到「双通道」：官方反馈（主）+ 开发者微信（副）。
反馈直接进 mp 后台「客服 → 用户反馈」，集中查看。

### 6. mp 后台隐私协议接口列表会自动扫描代码
mp 后台扫到代码用了 `wx.setClipboardData` / `wx.chooseMedia` 会自动提示填用途。
摄像头有时识别不到（因为是 `chooseMedia` 的 sourceType 子参数），需要手动添加。

---

## 🛠 常用快速恢复命令

```bash
cd /Users/dadao/WeChatProjects/miniprogram-1
git pull
git log --oneline -10           # 看最近改动
```

打开项目：
- 微信开发者工具 → 项目 → 打开最近项目 → 选「箭证」
- 云开发控制台：开发者工具右上角云开发按钮（橙色云）
- mp 后台：https://mp.weixin.qq.com

---

## 📌 v1.1.0 改动一览（共 18 个 commit）

```
fc87f27  perf: deleteAccount 并发删 + 云存储清理 + 首页合并短路             [Claude]
61c0e4a  fix(mine): 菜单 .menu-label 补 flex:1 · 右侧箭头对齐                [catsmao11]
167fcce  feat(mine): 新增「注销账号」· 永久删除账号及全部数据                [catsmao11]
b3e0f6d  fix: 首页拉云端训练记录改为合并本地未同步项 · 修「记录短暂消失」  [catsmao11]
08b5a13  feat(about): 反馈双通道 · 主走微信官方 feedback · 副留开发者微信号
a6607a7  feat: 新增「关于箭证」页 · 替换原 toast 入口
a6d6081  feat: 训练精彩时刻生成分享图 · canvas 渲染 + 保存到相册
8093b7b  feat: 训练详情页支持添加照片 · 删孤儿 handler openFeedList
e5966cd  fix: 修复分享功能 · 12 个页面声明 onShareAppMessage
1bab3b0  refactor: 抽 utils/training-helper.js
561ab05  refactor: 错误处理统一 · 抽 utils/error.js handleErr
07bcc8a  docs: 同步 2026-06 优化轮次 + 补两个关键索引说明
38d91a0  fix: 修两个 timer 退出页面前 setData on dead page 风险
83e7984  perf: 首屏加载提速 1.5s · history 分页 · image lazy-load
51faf0d  feat: 首次进入弹层引导授权头像/昵称
032f2f7  perf: 用户主页/俱乐部详情 5 分钟缓存 + 修两个 timer 内存泄漏
fb68480  perf: 列表分页上滑加载 · index feed + explore 箭友/俱乐部
dbb30ec  perf: 减少 data 页过量拉取 · 修俱乐部切换失败时 UI 不回滚
```

### 2026-06-07 注销账号专题（fc87f27 + 167fcce 详解）

**注销做了什么**：永久删 7 个集合的全部数据（club_members / feed_likes / follows / user_goals / social_feed / training_records / users）+ 训练照片云存储 + 头像云存储 + 各俱乐部 memberCount 递减。

**perf 优化细节**（fc87f27）：
- 6 集合 + memberCount 改 `Promise.all` 并发（串行 ~1-3s → 并发 ~300-600ms）
- `removeAll` helper 循环兜底 `.remove()` 单次 5000 上限（重度用户也能删干净）
- `collectUserFiles` + `deleteCloudFiles` 清云存储（满足"全部数据删除"审核要求）
- mine.js 注销后清 globalData 内存缓存（`userProfileCache` / `clubDetailCache`）
- index.js 合并逻辑短路：`pendingLocal` 为空时省 sort + storage 写（90% 场景）
