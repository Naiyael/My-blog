# Naiyael · 算法与日常

Vue 3 / VitePress / Teek 前台 + Cloudflare Worker 后端。文章保存在 D1，图片保存在 R2；编辑和发布不需要重新构建网站。

- 管理后台：/admin.html（使用站点所有者的 ChatGPT 账号）
- 所有文章：/journal.html；日常：/daily.html
- 支持文章、题解、日常、Markdown 预览、封面与正文图片、草稿、发布和可恢复归档。
- 写入校验站点管理员身份与 Origin；草稿和未发布图片不可匿名读取；版本检查避免并发覆盖。
- SITE_ADMIN_EMAIL 为 Sites 运行时私密配置，不写入源码。

## 开发与验证

1. npm install
2. npm run db:generate（仅在 schema 修改后新增迁移，已应用迁移不可修改）
3. npm run build
4. npm run dev

本地预览 http://127.0.0.1:4173。预览登录仅在 loopback 开发适配器中模拟，生产登录由 Sites 托管。本地数据库和图片在忽略的 .local-state/ 中，与线上数据分离。

npm test 验证草稿隔离、发布/归档、身份和跨站请求校验、图片上传、Markdown 安全、数据库持久化以及平台数据解析。

## OJ 自动同步

前台打开时每 60 秒读取同源 API；后端缓存 60 秒并合并并发请求。上游失败时保留上次成功数据并显示更新暂缓。

- Codeforces qiushan233：公开 API 同步 Rating、Rating 历史、提交动态、通过题目和标签。请求间隔至少 2.1 秒。Rating 以官方结算为准。
- 洛谷 1589332：读取公开 practice 页的通过题目、尝试题目和名称。逐次提交列表匿名访问返回 401，因此不能展示同一道题的每次 WA；新尝试/新 AC 会反映在练习记录中。
- node scripts/sync-platforms.mjs 手动更新本地回退数据；加 --watch 每分钟同步一次。网站运行时无需启动此本地脚本，也无需重新发布。

## 构建和数据

构建把 VitePress 静态资源压缩嵌入单个 ESM Worker，输出 dist/server/index.js；.openai/hosting.json 声明 DB / BUCKET。D1 schema 在 db/schema.ts，迁移在 drizzle/。发布会由 Sites 应用线上迁移。

Teek 许可证位于 research/TEEK-LICENSE.txt。本人头像位于 docs/public/images/avatar.jpg，封面摄影署名见 docs/sources.md。不要提交本地数据库、账号 Cookie 或运行时密钥。
