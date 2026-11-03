# Naiyael · 算法与日常

基于 MIT 开源主题 [Teek](https://github.com/Kele-Bingtang/vitepress-theme-teek) 的 Vue 3 + VitePress 个人博客。直接使用主题的首页、头像资料栏、分类、标签、站内搜索和移动导航。定制内容为本人提供的头像、Unsplash 山湖封面、Codeforces 与洛谷题目记录。

启动：`npm run dev`；构建：`npm run build`；生产预览：`npm run preview`。

数据来自 2026-11-03 的 Codeforces 公开 API，原始响应在 research/。运行 `node scripts/prepare-data.mjs` 生成 src/data/codeforces.json。204 道不同题目包含 Gym，不代表正式比赛成绩。洛谷 233 道来自用户截图可见部分，保留截图难度分组，位于 src/data/luogu.js。各平台分别统计；标签有重叠，不代表熟练度。

编辑页面：docs/*.md；主题配置：docs/.vitepress/config.mts；数据交互组件：docs/.vitepress/theme/components/。构建输出为 dist/，用于现有 Sites 网站部署。

头像位于 docs/public/images/avatar.jpg，使用本人提供的原图。封面 mountain-lake.jpg 来自 Francesco Ungaro / Unsplash，来源链接在 docs/sources.md。Teek 许可证保存在 research/TEEK-LICENSE.txt，页脚保留主题链接。日常页尚未添加个人文章。
