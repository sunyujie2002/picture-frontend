# 图库前端项目（picture-frontend）

基于后端 `picture-backend`（Spring Boot 2.7 + MyBatis-Plus，端口 `8123`，context-path `/api`）生成的前端项目，**后端暴露的 32 个接口已全部对接**。

## 技术栈

| 项 | 选型 |
| --- | --- |
| 框架 | Vue 3.4（Composition API + `<script setup>`） |
| UI 组件库 | Ant Design Vue 4.x |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 构建 | Vite 5 |
| 样式 | Less + CSS 变量设计令牌 |
| 请求 | Axios（统一拦截 `BaseResponse`） |

视觉方向：**现代简约浅色** —— 白底 / 柔和阴影 / 靛蓝品牌色 `#4F46E5` / 大圆角，突出图片内容本身。

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务（默认 http://localhost:3000）
npm run dev

# 生产构建
npm run build
```

开发环境下 Vite 会把 `/api` 代理到 `http://localhost:8123`（见 `vite.config.js`）。
若后端端口不同，修改 `vite.config.js` 的 `server.proxy.target` 即可；生产环境改 `.env.production` 的 `VITE_API_BASE_URL`。

### 图片地址前缀（COS 域名）

后端 `picture.url` / `picture.thumbnailUrl` 存的是 COS 的 **object key 相对路径**，例如：

```
public/image/1891234567890/abc123.webp
private/image/1891234567890/abc123.webp
temp/image/1891234567890/abc123.webp      ← 刚上传、尚未入库时
```

前端展示时需拼接对象存储访问域名，统一配置在环境变量里（开发/生产各一份）：

```bash
VITE_COS_BASE_URL=https://picture-1325885365.cos.ap-nanjing.myqcloud.com
```

解析逻辑集中在 `src/utils/image.js`：

| 方法 | 用途 |
| --- | --- |
| `resolveImageUrl(url)` | 相对路径 → 完整地址；已是 `http(s)://`、`//`、`data:`、`blob:` 的原样返回 |
| `displayUrl(picture)` | 优先缩略图，无缩略图回退原图（后端 `thumbnailUrl` 为空即表示无需缩略图） |
| `originUrl(picture)` | 原图地址，用于下载与复制链接 |

> **注意**：提交给后端的字段（`SavePictureRequest.url` / `thumbnailUrl`）始终保持原始相对路径，只有展示环节才拼接域名，避免把绝对地址写回数据库。

## 登录态说明

后端 `LoginInterceptor` 要求除 `/user/login`、`/user/register` 外的所有请求都携带 token：

```
Authorization: <登录接口返回的 token 字符串>
```

前端在 Axios 请求拦截器中统一注入，token 存于 `localStorage` 的 `picture_token`。
token 失效（业务码 `40100` 或 HTTP `401`）时会触发全局事件清理登录态并跳转登录页。

## ID 精度约定

后端 `JsonConfig` 把 `Long` / `long` 统一注册为 `ToStringSerializer`，所有 ID 在响应里都是 **JSON 字符串**。
雪花 ID 有 19 位，超过 JS 的 `Number.MAX_SAFE_INTEGER`，一旦转成 `Number` 末尾几位会被抹成 0，查询 / 删除 / 修改就会命中不到记录。

因此前端全程以字符串保存与传递 ID，规则如下：

- 不对 ID 使用 `Number()`、`parseInt()` 或 `a-input-number`，需要归一化时用 `String()`
- 提交给后端保持字符串，Jackson 会自动把数字字符串反序列化成 `Long`
- 只有 `picScale`、`picSize`、分页总数这类非 ID 数值才转成 `Number` 做格式化
- 分类 / 标签下拉的 `value` 直接用后端返回的 `id`（字符串），不额外转换

## 三个图片列表的分工

后端把图片列表拆成了三个接口，权限与数据范围各不相同，前端按语义分别对接，不要混用：

| 接口 | 页面 | 数据范围 | 备注 |
| --- | --- | --- | --- |
| `/picture/home/queryList` | 图库首页 `/` | 审核通过 **且** 不属于任何空间的图片 | 首页图库，游客也会访问 |
| `/picture/public/queryList` | 我的上传 `/my`、图片审核 `/admin/pictures` | `space_id` 为空的图片：普通用户只看自己上传的，**管理员可见全部用户（含自己）** | 支持按审核状态筛选，是"上传后管理"的入口 |
| `/picture/private/queryList` | 我的空间 `/space` | 当前用户个人空间下的图片 | **用户未创建空间时后端直接抛「用户未创建空间」**，前端据此引导创建空间 |

上传流程：上传 → 选 `public` / `private` 入库 → 公共图片进入「待审核」→ 管理员审核通过后才出现在首页图库；私有图片不参与审核，直接进私有图库。

## 接口对接清单

### 用户 `/user`

| 方法 | 路径 | 前端封装 | 使用页面 |
| --- | --- | --- | --- |
| POST | `/user/register` | `register` | 注册页 |
| POST | `/user/login` | `login` | 登录页 |
| POST | `/user/logout` | `logout` | 顶栏下拉 |
| GET | `/user/getLoginUser` | `getLoginUser` | 全局登录态 |
| POST | `/user/add` | `addUser` | 用户管理（仅管理员；只提交账号 / 昵称 / 角色，初始密码固定 123456） |
| POST | `/user/queryList` | `queryUserList` | 用户管理 |
| GET | `/user/getById` | `getUserById` | 个人中心 |
| POST | `/user/update` | `updateUser` | 用户管理（仅管理员；整体拷贝，可改账号 / 昵称 / 头像 / 简介 / 角色） |
| POST | `/user/updateMyInfo` | `updateMyInfo` | 个人中心（昵称 / 头像 / 简介） |
| POST | `/user/updatePassword` | `updatePassword` | 个人中心（修改密码） |
| POST | `/user/delete` | `deleteUser` | 用户管理 |

### 图片 `/picture`

| 方法 | 路径 | 前端封装 | 使用页面 |
| --- | --- | --- | --- |
| POST | `/picture/upload` | `uploadPicture` | 上传页（本地文件） |
| GET | `/picture/uploadByUrl` | `uploadPictureByUrl` | 上传页（URL） |
| POST | `/picture/uploadByBatch` | `uploadPictureByBatch` | 上传页（批量抓取，**仅管理员**） |
| POST | `/picture/{scope}/add` | `addPicture(scope, data)` | 上传页（`public` / `private`） |
| POST | `/picture/update` | `updatePicture` | 我的上传 / 私有图库 / 审核管理 |
| POST | `/picture/batch/update` | `batchEditPicture` | 我的上传 / 私有图库 / 审核管理 |
| POST | `/picture/batch/delete` | `batchDeletePicture` | 我的上传 / 私有图库 / 审核管理 |
| POST | `/picture/public/queryList` | `queryPublicPictureList` | 我的上传（管理员视角为公共图片管理）/ 图片审核管理 |
| POST | `/picture/private/queryList` | `queryPrivatePictureList` | 私有图库（兼作「是否已创建空间」探测） |
| POST | `/picture/home/queryList` | `queryHomePictureList` | 图库首页 |
| POST | `/picture/delete` | `deletePicture` | 我的上传 / 私有图库 / 审核管理 |
| GET | `/picture/queryById` | `queryPictureById` | 详情兜底（仅审核通过图片可用；列表已带全字段，详情优先用列表对象回显） |
| POST | `/picture/search/picture` | `searchPictureByPicture` | 以图搜图（首页 `/` 与空间 `/space` 的卡片入口；我的图片 `/my` 不提供） |
| POST | `/picture/review` | `reviewPicture` | 详情 / 审核管理（含批量） |

> 说明：图片详情不再依赖 `queryById`，而是由列表（queryList）返回的对象直接回显，避免对待审核 / 未通过图片误调 `queryById` 报错；`queryById` 仅作为无携带对象的深链兜底（仅审核通过图片可用）。以图搜图按 `pictureId` 的感知哈希全局查找相似图，入口仅出现在首页与空间页。

### 空间 `/space`

| 方法 | 路径 | 前端封装 | 使用页面 |
| --- | --- | --- | --- |
| POST | `/space/queryList` | `querySpaceList` | 我的空间（**优先调用**，后端占位实现 `data` 恒为 `null`，补全后自动接管容量数据） |
| POST | `/space/create` | `createSpace` | 我的空间（只提交 `spaceName`，后端固定普通版 `spaceLevel = 0`） |
| POST | `/space/update` | `updateSpace` | 我的空间：改名称（只传 `spaceId` + `spaceName`）、付费升级（传 `spaceId` + `spaceLevel`，`expandSize: 0`） |
| POST | `/space/delete` | `deleteSpace` | 未使用（不在用户侧暴露删除入口，**仅管理员**） |

### 分类 `/category`

| 方法 | 路径 | 前端封装 | 使用页面 |
| --- | --- | --- | --- |
| GET | `/category/queryList` | `queryCategoryList` | 全局字典（筛选 / 表单选项、名称翻译） |
| GET | `/category/admin/queryList` | `queryAdminCategoryList` | 分类管理（**仅管理员**） |
| POST | `/category/admin/add` | `addCategory` | 分类管理（**仅管理员**） |
| POST | `/category/admin/update` | `updateCategory` | 分类管理（**仅管理员**） |
| POST | `/category/admin/delete` | `deleteCategory` | 分类管理（**仅管理员**） |

### 标签 `/tag`

| 方法 | 路径 | 前端封装 | 使用页面 |
| --- | --- | --- | --- |
| GET | `/tag/queryList` | `queryTagList` | 全局字典（筛选 / 表单选项、名称翻译） |
| GET | `/tag/admin/queryList` | `queryAdminTagList` | 标签管理（**仅管理员**） |
| POST | `/tag/admin/add` | `addTag` | 标签管理（**仅管理员**） |
| POST | `/tag/admin/update` | `updateTag` | 标签管理（**仅管理员**） |
| POST | `/tag/admin/delete` | `deleteTag` | 标签管理（**仅管理员**） |

> 分类与标签的「增 / 改 / 删」在后端 service 层用 `@AuthCheck` 强制校验管理员，前端同步做了收敛：管理页路由标记 `admin: true`，页面上非管理员只可浏览、按钮置灰并给出提示。

## 目录结构

```
picture-frontend/
├── index.html
├── vite.config.js
├── .env.development / .env.production
└── src/
    ├── api/                  # 接口层（request.js 统一拦截）
    │   ├── request.js
    │   ├── user.js
    │   ├── picture.js
    │   ├── category.js
    │   ├── tag.js
    │   └── space.js
    ├── components/           # 复用组件
    │   ├── PictureCard.vue        # 图片卡片（横向网格单元，含以图搜图入口）
    │   ├── PictureGrid.vue        # 横向响应式网格容器（替换原竖向瀑布流）
    │   ├── PictureEditModal.vue   # 图片信息编辑弹窗
    │   ├── TaxonomyManager.vue    # 分类 / 标签通用增删改查（管理员）
    │   ├── ColorPicker.vue        # 主色调选择器（预设色 + 取色器）
    │   └── AuthLayout.vue         # 登录 / 注册分屏布局
    ├── layouts/BasicLayout.vue    # 顶栏 + 内容 + 页脚
    ├── views/
    │   ├── Home.vue               # 图库首页（home/queryList）
    │   ├── PictureDetail.vue      # 图片详情（列表对象回显，不再调 byId）
    │   ├── UploadPicture.vue      # 三种上传方式 + 入库
    │   ├── MyPictures.vue         # 私有图片管理 + 批量操作
    │   ├── SpaceManage.vue        # 空间增删改查
    │   ├── AdminPictures.vue      # 公共图库审核管理
    │   ├── AdminUsers.vue         # 用户管理
    │   ├── AdminCategories.vue    # 分类管理（仅管理员）
    │   ├── AdminTags.vue          # 标签管理（仅管理员）
    │   ├── Profile.vue            # 个人中心
    │   ├── Login.vue / Register.vue
    │   └── NotFound.vue
    ├── stores/user.js        # 登录态
    ├── stores/dict.js        # 分类 / 标签字典（id ↔ 名称，含管理端列表）
    ├── router/index.js       # 路由 + 权限守卫
    ├── utils/format.js       # 体积/时间/颜色格式化
    ├── constants/index.js    # 审核状态、空间级别、角色等枚举
    └── styles/global.less    # 设计令牌与通用样式
```

## 页面与权限

| 页面 | 路径 | 访问权限 |
| --- | --- | --- |
| 图库首页 | `/` | 公开（未登录时提示登录） |
| 图片详情 | `/picture/:id` | 公开 |
| 上传图片 | `/upload` | 需登录（批量抓取仅管理员） |
| 我的上传 | `/my` | 需登录（管理员视角为「公共图片管理」，可见全部用户上传） |
| 我的空间 | `/space` | 需登录。未创建空间 → 创建引导；已创建 → 空间概览（容量环形图）+ 私有图片列表 |
| 个人中心 | `/profile` | 需登录（编辑资料 + 修改密码） |
| 图片审核管理 | `/admin/pictures` | 需管理员 |
| 用户管理 | `/admin/users` | 需管理员 |
| 分类管理 | `/admin/categories` | 需管理员 |
| 标签管理 | `/admin/tags` | 需管理员 |

管理员身份来自 `user_role === 'admin'`，菜单项「管理后台」仅管理员可见；上传页的「批量抓取」页签同样仅管理员渲染。

## 后端需注意的几处

1. **`/space/queryList` 目前是占位实现**，`data` 固定返回 `null`。前端每次进入空间页会先尝试它、失败后降级：`spaceId` 没有查询入口，只能在创建成功时把返回的 id 记在本地（按用户维度存 `localStorage`）；**已用容量**用 `/picture/private/queryList` 逐页累加 `picSize` 估算（单页 200 条、最多 10 页），**总容量**用 `SpaceLevelEnum` 的等级常量兜底。补一个返回当前用户空间详情的接口（或修复 `queryList` 返回 `records`）就能去掉这层兜底——前端会自动切到服务端值，界面上的「估算」提示也随之消失。
2. **`addSpace` 固定把 `spaceLevel` 写成 0**，不读取请求里的 `spaceLevel`，所以创建页只填空间名称、不提供等级选择。
3. **`updateSpace` 目前无法支撑「用户改名称」与「付费升级」**：
   - 改名称只传 `spaceId` + `spaceName` → `BeanUtil.copyProperties` 后 `spaceLevel` 为 `null`，`fillSpaceByLevel` 抛「空间等级不存在」；
   - 补上 `spaceLevel` → `!isAllEmpty(spaceLevel, expandSize)` 成立且非管理员 → 抛「您没有权限更新该空间」；
   - 无论哪种情况，`spaceRequest.getExpandSize() * 1024 * 1024` 在 `expandSize` 为 `null` 时都会空指针。

   建议后端按下面方式放开（前端已按目标语义发参，改完即可用）：
   ```java
   // 1) expandSize 缺失时按 0 处理，避免空指针
   Long expandSize = ObjectUtil.defaultIfNull(spaceRequest.getExpandSize(), 0L) * 1024 * 1024;
   // 2) spaceLevel 缺失时沿用旧值，使「只改名称」成立
   if (spaceRequest.getSpaceLevel() == null) space.setSpaceLevel(oldSpace.getSpaceLevel());
   // 3) 权限：仅「扩容」要求管理员；改名与升级允许空间本人（升级另需支付校验）
   ThrowUtil.throwIf(spaceRequest.getExpandSize() != null && !isAdmin, ...);
   ```
   另外 `deleteSpace` 带 `@AuthCheck`，前端不在用户侧暴露删除入口。
4. **`LoginInterceptor` 拦截了 `/picture/home/queryList`**，即未登录无法浏览公共图库。若希望首页对游客开放，需在 `WebMvcConfig.excludePathPatterns` 中放行该路径。
5. **`/user/update` 标注了 `@AuthCheck`（仅管理员）**，所以它只用于「用户管理」；个人中心改走 `/user/updateMyInfo`（昵称 / 头像 / 简介，目标用户由服务端从登录态确定）。
6. **头像统一走图片上传接口**：先调 `/picture/upload`（文件落在 `temp/image/{登录用户id}/...`），把返回的 `url` 填进 `userAvatar` 再提交。
   - 个人中心 `/user/updateMyInfo`：服务端校验 temp 前缀后复制到 `avatar/image/{userId}/`，所以**只有本次会话新上传时才提交该字段**，回传已生效的 `avatar/image/...` 会被判「头像地址非法」。
   - 管理员编辑 `/user/update`：后端按原样保存该地址、不做迁移，头像会留在 temp 目录（管理员与他人共用上传目录，且 temp 可能被清理），需要长期头像建议后端也做一次迁移。
7. **`addUser` 只接受账号 / 昵称 / 角色**：密码固定为 `123456`，头像与简介即使传了也会被忽略（所以新增表单不提供这两项）；账号与昵称都做唯一性校验，昵称重复会报「用户昵称已存在」。`updateUser` 则由 `BeanUtil` 整体拷贝，账号、昵称、头像、简介、角色都能改，但不校验唯一性，重复会落到数据库异常。
8. **图片的 `tags` 与 `categoryId` 仍只返回 ID**，名称由前端查询 `/category/queryList`、`/tag/queryList` 后在 `stores/dict.js` 里做 id → 名称翻译；字典缺失时回退成 `#id`。
9. **分类 / 标签的列表接口同样被 `LoginInterceptor` 覆盖**，未登录时前端不请求字典（避免每次进首页弹「未登录」），此时展示退化为 `#id`。若希望游客也能看到中文分类名，可在拦截器里放行这两个 `queryList`。
10. **管理员在公共图片列表里看到的 `userId` 没有对应用户名接口**，前端用 `/user/getById` 逐个查询并按 id 缓存（见 `utils/uploader.js`）。如果有批量查询用户的接口，可以替换掉这个逐条请求。
