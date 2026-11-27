# Naiyael · 算法与日常

Vue 3 / VitePress / Teek 静态前台 + **Cloudflare Workers Static Assets + D1** 边缘全栈博客。静态资源由 Cloudflare 边缘 CDN 直接下发，文章、置顶排序与顶部导航保存在 D1，编辑和发布无需重新构建网站。

- 管理后台：`/admin.html`（支持**管理密码登录**与 **Cloudflare Zero Trust Access JWT** 双模式鉴权）
- 所有文章：`/journal.html`；日常：`/daily.html`
- 支持文章、题解、日常、自定义分类、Markdown 实时预览与目录、拖拽排序/置顶、草稿/发布/归档/可恢复回收站。
- 图片默认采用外部 `https://` 图床链接或站内 `/images/` 路径（无需开通 R2 绑卡）；如后续开通 Cloudflare R2，只需在 [wrangler.jsonc](./wrangler.jsonc) 取消 `r2_buckets` 注释即可自动开启后台本地上传与隐私门控。
- 写入强制校验管理员身份与同源 `Origin`，并发编辑带 `version` 乐观锁；`old` 分支保留了迁移前的原始版本。

---

## 本地开发与验证

1. 安装依赖并准备本地变量：
   ```bash
   npm install
   cp .dev.vars.example .dev.vars
   ```
   编辑 `.dev.vars`，至少设置 `ADMIN_PASSWORD`（此文件已被 `.gitignore` 忽略，切勿提交）。
2. 构建静态页面、应用本地 D1 迁移并启动 Wrangler 本地预览：
   ```bash
   npm run preview
   ```
   启动后访问 Wrangler 输出的本地地址（默认 `http://127.0.0.1:8787`，后台为 `/admin.html`）。
3. 常用脚本：
   - `npm run dev:theme`：仅调试 VitePress/Teek 主题热重载
   - `npm run build`：仅构建 VitePress 静态资源到 `dist/`
   - `npm run db:generate`：修改 `db/schema.ts` 后生成新 SQL 迁移（已应用迁移不可修改）
   - `npm test`：运行单元测试（涵盖密码/PBKDF2/CF Access JWT 鉴权、外链图片校验、草稿隔离、乐观锁、排序、导航与 OJ 解析）

---

## 部署到 Cloudflare Workers & Pages

### 方式一：连接 GitHub 自动部署（推荐）

1. 打开 Cloudflare 控制台 → **Workers & Pages** → **Create** → 选择 **Workers** → **Import a repository**，关联 `Naiyael/My-blog` 的 `main` 分支。
2. 配置构建与部署命令：
   - **Build command**：`npm run build`
   - **Deploy command**：`npx wrangler deploy`
3. 在 Cloudflare 控制台 → **Storage & Databases → D1 SQL Database** 确认已创建名为 `naiyael-blog-db` 的数据库（Wrangler 4 首次部署也会自动创建），然后执行一次远程迁移初始化表结构：
   ```bash
   npx wrangler login
   npm run db:migrate:remote
   ```
   > 也可以把 Deploy command 设为 `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`，让每次发布自动应用新迁移。
4. 在 Worker 的 **Settings → Variables and Secrets** 中添加密钥（Secret）：
   - **必选（密码登录开箱即用）**：
     - `ADMIN_PASSWORD`：你的管理后台登录密码
     - `SESSION_SECRET`（可选但推荐）：随机 32 位以上字符串，用于签发 `HttpOnly` 登录 Cookie；更换后可立即使旧登录态失效
   - **可选（同时启用 Cloudflare Zero Trust Access）**：
     - `CF_ACCESS_TEAM_DOMAIN`：例如 `https://<your-team>.cloudflareaccess.com`
     - `CF_ACCESS_AUD`：在 Zero Trust Access 应用设置中复制的 Application Audience (AUD) Tag
     - `SITE_ADMIN_EMAIL`：允许进入后台的管理员邮箱（与 Access JWT 中的邮箱匹配）

### 方式二：本地 CLI 一键部署

```bash
npx wrangler login
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy
npm run db:migrate:remote
```

---

## 如何管理文章与备份

- **日常写作**：访问 `https://<你的域名>/admin.html` 登录后台即可新建、编辑、预览、拖拽排序、置顶、发布、归档或移入回收站，点击发布后秒级生效。
- **封面与配图**：推荐使用免费图床（如 GitHub + jsDelivr、SM.MS、Imgur 等）或将常用静态图放入 `docs/public/images/` 后填 `/images/文件名`；在编辑器的「摘要与封面」和正文工具栏「＋ 图片链接」中直接填入 `https://` 链接即可。
- **定期备份**：
  - 在后台右上角点击「**导出备份 ↓**」下载包含全部文章（含草稿与回收站）、排序与导航配置的 JSON 文件。
  - 或通过 CLI 导出完整 SQLite 快照：`npx wrangler d1 export naiyael-blog-db --remote --output=backup.sql`。

---

## OJ 自动同步

前台打开时每 60 秒请求同源 API，Worker 侧使用内存 + `caches.default` 双层缓存（60 秒刷新）并合并并发上游请求；上游不可用时保留上次成功数据或降级至内置快照并提示“更新暂缓”。

- **Codeforces (`qiushan233`)**：公开 API 同步 Rating、历史曲线、近期提交、通过题目与标签，请求间隔 ≥ 2.1 秒。
- **洛谷 (`1589332`)**：解析公开 practice 页的通过与尝试记录。
- `npm run sync`（可加 `--watch`）可用于手动更新仓库内嵌的回退快照 `src/data/*.json`。

---

## 致谢与许可

Teek 许可证位于 `research/TEEK-LICENSE.txt`，Devicon 许可证位于 `research/DEVICON-LICENSE.txt`，署名说明见 `docs/sources.md`。切勿将 `.dev.vars`、本地数据库或运行时密钥提交到仓库。
