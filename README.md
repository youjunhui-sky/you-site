# you-site — 个人主页

独立开发者 · FDE 的对外门面：X 引流 → 本站展示工作成果 → X 私信接单。
内容结构参考 antfu.me（第一人称叙述）与 brianlovin.com（可扫读的项目列表）。
纯静态单 HTML，零构建。

- 线上：`https://iam.youjunhui.workers.dev`（子域改后）· 过渡期 `https://iam.youjh120608.workers.dev`
- 仓库：`github.com/youjunhui-sky/you-site`（public）
- 部署：push main → GitHub Actions → `wrangler deploy`（worker 名 `iam`）+ 线上探活

## 改身份（名字 / X 账号）

打开 `public/index.html`，改 `<script>` 里的 `SITE` 常量即可，全站自动同步：

```js
const SITE = {
  name: "Aaron",        // 站点署名
  x: "",                // X 手柄（不带 @），留空不显示
  github: "youjunhui-sky",
  email: "",            // 留空不显示
};
```

## 改文案（双语）

页面文案 = 中文源 + 英文词典：中文直接改 `public/index.html` 里带 `data-i18n` 标记的文本；
英文在 `<script>` 里的 `I18N_EN` 词典，键名与 `data-i18n` 一一对应（当前 37 键，改动后两侧都要同步）。
切换逻辑：导航栏 EN/中 按钮，选择存 localStorage，首次访问按浏览器语言自动选。

## 本地预览

```bash
cd public && python3 -m http.server 4173
# 浏览器开 http://localhost:4173
```

## 绑自有域名（可选）

在 `wrangler.jsonc` 加 routes（域名需已接入本 Cloudflare 账号）：

```jsonc
"routes": [
  { "pattern": "you.example.com", "custom_domain": true }
]
```

## 首次部署前置（已由主会话完成则跳过）

1. GitHub 仓库 Secrets 配 `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
2. push main 即上线
