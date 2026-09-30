# you-site — 个人名片站

极简单页名片站：数据工程 × 全栈。纯静态单 HTML，零构建。

- 线上：`https://iam.youjunhui.workers.dev`（子域改后）· 过渡期 `https://iam.youjh120608.workers.dev`
- 仓库：`github.com/youjunhui-sky/you-site`（public）
- 部署：push main → GitHub Actions → `wrangler deploy`（worker 名 `iam`）+ 线上探活

## 改身份（名字 / X 账号）

打开 `public/index.html`，改 `<script>` 里的 `SITE` 常量即可，全站自动同步：

```js
const SITE = {
  name: "youjunhui",    // 站点署名
  x: "",                // X 手柄（不带 @），留空不显示
  github: "youjunhui-sky",
  email: "",            // 留空不显示
};
```

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
