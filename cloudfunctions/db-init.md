# 云数据库集合初始化说明

在微信开发者工具「云开发控制台 → 数据库」手动创建以下集合，并按说明建索引。

---

## 集合列表

### 1. `users` — 用户资料
| 字段            | 类型    | 说明                         |
|----------------|---------|------------------------------|
| `_id`          | string  | 云数据库自动生成              |
| `_openid`      | string  | 微信 openid（唯一）           |
| `nickName`     | string  | 昵称                         |
| `avatarUrl`    | string  | 头像 URL（云存储路径）        |
| `phone`        | string  | 手机号（可选）                |
| `bio`          | string  | 个人简介                     |
| `clubId`       | string  | 所属俱乐部 _id，可选          |
| `createdAt`    | date    | 注册时间                     |

**索引**：`_openid`（唯一）

---

### 2. `training_records` — 训练记录
| 字段            | 类型    | 说明                            |
|----------------|---------|---------------------------------|
| `_openid`      | string  | 记录归属用户                    |
| `ts`           | number  | 训练开始时间戳（毫秒）           |
| `bowType`      | string  | 弓种：recurve/compound/barebow/longbow |
| `distance`     | string  | 距离：10m/18m/30m/50m/70m       |
| `targetSize`   | string  | 靶面：40cm/60cm/80全/80半/122cm  |
| `mode`         | string  | 训练模式：ranking/elimination/custom |
| `totalScore`   | number  | 总成绩（环数）                  |
| `totalArrows`  | number  | 总箭数                          |
| `totalEnds`    | number  | 总组数                          |
| `arrowsPerEnd` | number  | 每组箭数                        |
| `avgPerArrow`  | number  | 均环/支                         |
| `bestEndTotal` | number  | 单组最高分                      |
| `durationMin`  | number  | 训练时长（分钟）                |
| `note`         | string  | 训练备注                        |
| `endResults`   | array   | 每组详情 [{endNum, arrows[], total}] |
| `createdAt`    | date    | 云端写入时间                    |

**索引**：
- `_openid + ts`（降序，常用查询）
- `_openid + distance + bowType + totalScore`（用于查最高分）

---

### 3. `user_goals` — 训练目标
| 字段          | 类型   | 说明                 |
|--------------|--------|----------------------|
| `_openid`    | string | 目标归属用户          |
| `distance`   | string | 目标距离             |
| `bowType`    | string | 目标弓种             |
| `targetScore`| number | 目标环数             |
| `deadline`   | string | 截止日期（YYYY-MM-DD）|
| `updatedAt`  | date   |                      |
| `createdAt`  | date   |                      |

**索引**：`_openid`

---

### 4. `follows` — 关注关系
| 字段          | 类型   | 说明             |
|--------------|--------|------------------|
| `_openid`    | string | 关注者 openid    |
| `followingId`| string | 被关注者 openid  |
| `createdAt`  | date   |                  |

**索引**：`_openid + followingId`（唯一）

---

### 7. `social_feed` — 箭友动态
| 字段          | 类型   | 说明                    |
|--------------|--------|-------------------------|
| `_openid`    | string | 动态作者 openid         |
| `recordId`   | string | 关联的 training_records _id |
| `ts`         | number | 训练时间戳（用于排序）   |
| `bowType`    | string |                         |
| `distance`   | string |                         |
| `totalScore` | number |                         |
| `totalArrows`| number |                         |
| `mode`       | string |                         |
| `note`       | string |                         |
| `likes`      | number | 点赞数，默认 0           |
| `createdAt`  | date   |                         |

**索引**：
- `_openid + ts`（降序，查个人公开动态）
- `ts`（降序，**关键**：首页 getPublicFeed 跨用户按时间排序，缺此索引会触发全表扫描）

---

### 9. `feed_likes` — 动态点赞记录
| 字段      | 类型   | 说明                       |
|----------|--------|----------------------------|
| `_openid`| string | 点赞用户 openid            |
| `feedId` | string | social_feed 文档 _id       |
| `ts`     | date   | 点赞时间                   |

**索引**：`_openid + feedId`（唯一，防重复点赞）

---

### 10. `clubs` — 俱乐部
| 字段              | 类型   | 说明                       |
|------------------|--------|----------------------------|
| `name`           | string | 俱乐部名称（唯一）          |
| `city`           | string | 所在城市（可选）            |
| `creatorOpenid`  | string | 创建者 openid              |
| `memberCount`    | number | 成员数，默认 1              |
| `createdAt`      | date   |                            |

**索引**：`name`（唯一）、`memberCount`（降序，用于列表排序）

---

### 11. `club_members` — 俱乐部成员关系
| 字段       | 类型   | 说明                  |
|-----------|--------|----------------------|
| `_openid` | string | 成员 openid          |
| `clubId`  | string | clubs 文档 _id       |
| `joinedAt`| date   | 加入时间              |

**索引**：
- `_openid + clubId`（唯一，防重复加入）
- `clubId + joinedAt`（升序，**关键**：俱乐部详情按加入时间列成员）

---

### 8. `notifications` — 系统通知
| 字段        | 类型    | 说明                              |
|------------|---------|-----------------------------------|
| `_openid`  | string  | 接收者 openid                     |
| `type`     | string  | club / social / system            |
| `title`    | string  | 通知标题                          |
| `desc`     | string  | 通知内容                          |
| `read`     | boolean | 是否已读                          |
| `relatedId`| string  | 关联 ID（俱乐部 _id / 用户 openid）|
| `createdAt`| date    |                                   |

**索引**：`_openid + read + createdAt`

---

## 数据库权限设置

云开发控制台 → 数据库 → 每个集合 → 权限设置：

| 集合                   | 建议权限              |
|-----------------------|-----------------------|
| users                 | 仅创建者可读写        |
| training_records      | 仅创建者可读写        |
| user_goals            | 仅创建者可读写        |
| follows               | 仅创建者可读写        |
| social_feed           | 所有人可读，仅创建者写 |
| notifications         | 仅创建者可读写        |
| feed_likes            | 仅创建者可读写        |
| clubs                 | 所有人可读，仅创建者写 |
| club_members          | 仅创建者可读写        |

## 云存储权限

云开发控制台 → 存储 → 权限设置：

| 路径前缀     | 权限              |
|------------|------------------|
| `avatars/` | 所有人可读，仅上传者可写 |

> 注意：云函数运行在服务端，拥有管理员权限，不受以上规则限制。  
> 以上规则只影响小程序端直接访问数据库的情况（我们的项目全走云函数，权限规则只是额外安全保障）。
