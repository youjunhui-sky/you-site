# 网站优化交接（PC 小X → 云端小天）

## 现状
- main 分支 = 线上运行版（Cloudflare Workers + D1 统计 + Actions 自动部署）
- 本分支 redesign/dark-fused = PC 侧准备的「暗色融合版」前端草稿（东家已确认喜欢的方向），public/index.html 可直接用或继续改

## 东家已确认的设计方向
- 暗色为主 + 渐变点缀（紫→青）
- 氛围光斑跟随鼠标、打字机轮播、头像/Logo 点击彩蛋、滚动渐显
- 内容=真实项目（Crosspower/经营预警/Callsun/私域CRM/南非POS），不要占位

## 待办（brianlovin.com 风格优化，按优先级）
1. P1 Writing 区自动化：把 X 已发精华帖沉淀为文章列表（数据源：PC 侧流水线 seen 库与 X 时间线）
2. P1 公开 Activity 区：D1 events 表已有访客数据，加公开聚合端点（总访问/今日/近7天），首页展示「本站 N 天 · N 次访问」
3. P2 Stack 页实质化：装备/工具清单（亮点：本站由 AI Agent 全自动维护）
4. P2 分享体验：OG 图 + llms.txt + sitemap
5. P3 TIL/短想法区、AMA 页

## 部署机制（重要）
- push 到 main → GitHub Actions 自动部署（deploy.yml）→ 线上生效
- 冒烟门：deploy 后用仓库 Secret ADMIN_KEY_SEED 校验 /admin?key=*** —— **改 Worker 的 ADMIN_KEY 必须同步更新这个 Secret**，否则部署会被冒烟门误判失败
- 多机：push 前先 git pull（10-04 曾发生旧提交覆盖新设计事故）

## API 速查
- POST /api/track  {t: visit|click|sec|out|hb, sid, el?, ms?, ref?, w?, h?} → D1 events 表
- GET /admin?key=***  后台（today/7d/30d/all 范围）
- 隐私：无 Cookie，IP 不落库（当日 sha256 摘要去重计 UV）
