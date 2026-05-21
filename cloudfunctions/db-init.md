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
| `isOrganizer`  | boolean | 是否为赛事方，默认 false      |
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

### 4. `events` — 赛事信息
| 字段                   | 类型    | 说明                              |
|-----------------------|---------|-----------------------------------|
| `_openid`             | string  | 创建者（赛事方）openid             |
| `title`               | string  | 赛事名称                          |
| `organizer`           | string  | 主办方名称                        |
| `location`            | string  | 比赛地点                          |
| `startDate`           | string  | 开始日期（显示用）                 |
| `endDate`             | string  | 结束日期（显示用）                 |
| `startTimestamp`      | number  | 开始时间戳（用于排序）             |
| `regEnd`              | string  | 报名截止日期                       |
| `fee`                 | number  | 报名费（元）                       |
| `maxParticipants`     | number  | 最大报名人数                       |
| `currentParticipants` | number  | 当前报名人数                       |
| `status`              | string  | registration_open/registration_closed/full/ended |
| `featured`            | boolean | 是否精选展示                       |
| `categories`          | array   | 竞赛项目列表                       |
| `schedule`            | array   | 赛程 [{date, time, item}]          |
| `contacts`            | array   | 联系人 [{name, phone, role}]       |
| `createdAt`           | date    |                                   |

**索引**：
- `status + startTimestamp`（列表筛选 + 排序）
- `featured`（精选查询）

**权限**：所有人可读，只有创建者可写（云函数端已鉴权）

---

### 5. `event_registrations` — 报名记录
| 字段                | 类型   | 说明                          |
|--------------------|--------|-------------------------------|
| `_openid`          | string | 报名用户 openid               |
| `eventId`          | string | 赛事 _id                      |
| `eventTitle`       | string | 赛事名称（冗余，避免联表查询）  |
| `category`         | string | 参赛项目                      |
| `realName`         | string | 真实姓名                      |
| `phone`            | string | 联系电话                      |
| `idType`           | string | 证件类型：id_card/passport     |
| `idNumber`         | string | 证件号码                      |
| `club`             | string | 所属俱乐部（可选）             |
| `fee`              | number | 应付费用                      |
| `status`           | string | pending/confirmed/cancelled   |
| `participantNumber`| string | 参赛号码（主办方填写）         |
| `createdAt`        | date   |                               |

**索引**：
- `_openid + createdAt`（我的报名列表）
- `eventId + status`（赛事方管理）

---

### 6. `follows` — 关注关系
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
| `_openid`    | string | 发布者 openid           |
| `recordId`   | string | 关联的 training_records _id |
| `ts`         | number | 训练时间戳（用于排序）   |
| `bowType`    | string |                         |
| `distance`   | string |                         |
| `totalScore` | number |                         |
| `totalArrows`| number |                         |
| `mode`       | string |                         |
| `note`       | string |                         |
| `createdAt`  | date   |                         |

**索引**：`_openid + ts`（降序）

---

### 8. `notifications` — 系统通知
| 字段        | 类型    | 说明                              |
|------------|---------|-----------------------------------|
| `_openid`  | string  | 接收者 openid                     |
| `type`     | string  | event / social / system           |
| `title`    | string  | 通知标题                          |
| `desc`     | string  | 通知内容                          |
| `read`     | boolean | 是否已读                          |
| `relatedId`| string  | 关联 ID（报名 _id / 用户 openid）  |
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
| events                | 所有人可读，仅创建者写 |
| event_registrations   | 仅创建者可读写        |
| follows               | 仅创建者可读写        |
| social_feed           | 所有人可读，仅创建者写 |
| notifications         | 仅创建者可读写        |

> 注意：云函数运行在服务端，拥有管理员权限，不受以上规则限制。  
> 以上规则只影响小程序端直接访问数据库的情况（我们的项目全走云函数，权限规则只是额外安全保障）。
