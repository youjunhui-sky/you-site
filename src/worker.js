// iam.youjunhui.workers.dev — 静态资产 + 自托管匿名统计
// 路由：POST /api/track 埋点入库（D1）· /admin?key= 后台看板 · 其余走静态资产
// 隐私：无 Cookie，IP 不落库（只存当日 IP+UA 摘要用于去重计 UV）

const TYPE_RE = /^(visit|click|sec|out|hb)$/;
const EL_RE = /^[a-zA-Z0-9:_/.-]{0,48}$/;
const SID_RE = /^[0-9a-f-]{8,40}$/;
const REF_RE = /^[a-zA-Z0-9._-]{0,100}$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/track") {
      if (request.method !== "POST") return json({ ok: false, err: "method" }, 405);
      return handleTrack(request, env);
    }
    if (url.pathname === "/admin") return handleAdmin(url, env);
    if (url.pathname === "/api/health") return json({ ok: true });
    return env.ASSETS.fetch(request);
  },
};

async function handleTrack(request, env) {
  if (!env.DB) return json({ ok: false, err: "db" }, 503);
  const ua = request.headers.get("user-agent") || "";
  // 爬虫/预览器/自检流量静默吞掉
  if (!ua || /bot|crawl|spider|slurp|preview|curl|wget|python|headless|monitor/i.test(ua))
    return new Response(null, { status: 204 });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, err: "json" }, 400);
  }
  if (!body || typeof body !== "object") return json({ ok: false, err: "body" }, 400);

  const type = TYPE_RE.test(body.t) ? body.t : null;
  const sid = typeof body.sid === "string" ? body.sid : "";
  if (!type || !SID_RE.test(sid)) return json({ ok: false, err: "field" }, 400);

  let el = typeof body.el === "string" ? body.el : "";
  if (el && !EL_RE.test(el)) el = "";
  let ms = Number(body.ms);
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  ms = Math.min(Math.round(ms), 120000);
  let ref = typeof body.ref === "string" ? body.ref : "";
  if (ref && !REF_RE.test(ref)) ref = "";
  const w = Number(body.w) || 0;
  const h = Number(body.h) || 0;

  // 当日去重指纹：sha256(ip|ua|date) 截 16 位，不可逆
  const ip = request.headers.get("cf-connecting-ip") || "";
  const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Asia/Shanghai 日界
  const uhash = (await sha256hex(ip + "|" + ua + "|" + day)).slice(0, 16);
  const country = (request.cf && request.cf.country) || "";

  try {
    await env.DB.prepare(
      "INSERT INTO events (ts,sid,type,el,ms,ref,country,w,h,ua,uhash) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    )
      .bind(
        Date.now(), sid, type, el || null, ms || null, ref || null,
        country || null, w || null, h || null, ua.slice(0, 180), uhash
      )
      .run();
  } catch {
    return json({ ok: false, err: "insert" }, 500);
  }
  return new Response(null, { status: 204 });
}

// ---------- /admin ----------

function sinceMs(range) {
  const now = Date.now();
  if (range === "today") {
    const d = new Date(now + 8 * 3600e3); // 上海当天零点
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime() - 8 * 3600e3;
  }
  if (range === "7d") return now - 7 * 86400e3;
  if (range === "30d") return now - 30 * 86400e3;
  return 0;
}

async function handleAdmin(url, env) {
  if (!env.DB || !env.ADMIN_KEY) return new Response("admin not ready", { status: 503 });
  const key = url.searchParams.get("key") || "";
  if (!key || (await sha256hex(key)) !== (await sha256hex(env.ADMIN_KEY)))
    return new Response("unauthorized", { status: 401 });

  const range = ["today", "7d", "30d", "all"].includes(url.searchParams.get("range"))
    ? url.searchParams.get("range")
    : "7d";
  const since = sinceMs(range);

  const q = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).all()).results;

  try {
    const [[summary], [dwell], daily, clicks, sections, outbound, recent] = await Promise.all([
      q("SELECT COUNT(*) pv, COUNT(DISTINCT uhash) uv, COUNT(DISTINCT sid) sessions FROM events WHERE type='visit' AND ts>?", since),
      q("SELECT COALESCE(SUM(ms),0) total_ms FROM events WHERE type='hb' AND ts>? AND sid IN (SELECT DISTINCT sid FROM events WHERE type='visit' AND ts>?)", since, since),
      q("SELECT date((ts/1000+28800)/86400.0,'unixepoch') d, COUNT(*) pv, COUNT(DISTINCT uhash) uv FROM events WHERE type='visit' AND ts>? GROUP BY d ORDER BY d DESC LIMIT 30", since),
      q("SELECT el, COUNT(*) n FROM events WHERE type='click' AND ts>? AND el<>'' GROUP BY el ORDER BY n DESC LIMIT 15", since),
      q("SELECT el, COUNT(DISTINCT sid) n FROM events WHERE type='sec' AND ts>? AND el<>'' GROUP BY el ORDER BY n DESC LIMIT 10", since),
      q("SELECT el, COUNT(*) n FROM events WHERE type='out' AND ts>? AND el<>'' GROUP BY el ORDER BY n DESC LIMIT 15", since),
      q(`SELECT v.ts, v.ref, v.country, v.w, v.h, v.sid,
                COALESCE((SELECT SUM(ms) FROM events h WHERE h.type='hb' AND h.sid=v.sid AND h.ts>=v.ts),0) dwell_ms
         FROM events v WHERE v.type='visit' AND v.ts>? ORDER BY v.ts DESC LIMIT 25`, since),
    ]);

    const sessions = Math.max(summary.sessions, 1);
    const avgSec = Math.round(dwell.total_ms / 1000 / sessions);
    const totalMin = Math.round(dwell.total_ms / 60000);
    const maxPv = Math.max(...daily.map((d) => d.pv), 1);

    const tab = (r, label) =>
      `<a class="tab${r === range ? " on" : ""}" href="/admin?key=${encodeURIComponent(key)}&range=${r}">${label}</a>`;
    const rows = (arr, f) =>
      arr.length ? arr.map(f).join("") : `<div class="empty">暂无数据</div>`;

    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>后台 · you-site</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#0c0a09;color:#fafaf9;font-size:15px;line-height:1.6}
.wrap{max-width:880px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:20px;letter-spacing:-.01em} h1 small{color:#a8a29e;font-weight:400;font-size:13px;margin-left:8px}
h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a8a29e;margin:34px 0 12px;font-family:ui-monospace,monospace}
.tabs{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap}
.tab{padding:5px 14px;border:1px solid #292524;border-radius:99px;color:#a8a29e;text-decoration:none;font-size:13px}
.tab.on{border-color:#fafaf9;color:#fafaf9}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:18px}
.card{background:#151210;border:1px solid #292524;border-radius:12px;padding:14px 16px}
.card b{display:block;font-size:26px;font-weight:700;letter-spacing:-.02em}
.card span{font-size:12px;color:#a8a29e}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{padding:9px 6px;border-bottom:1px solid #232019;text-align:left;vertical-align:top}
th{color:#a8a29e;font-weight:500;font-size:12px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.bar{height:6px;background:#292524;border-radius:3px;margin-top:5px;max-width:220px}
.bar i{display:block;height:6px;border-radius:3px;background:#4ade80}
.chart{display:flex;align-items:flex-end;gap:4px;height:90px;margin-top:10px}
.chart .c{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
.chart .b{width:100%;background:#3f3f36;border-radius:3px 3px 0 0;min-height:2px}
.chart .d{font-size:9px;color:#78716c;white-space:nowrap}
.empty{color:#78716c;padding:14px 0;font-size:14px}
.mut{color:#a8a29e;font-size:12px}
.new{color:#4ade80}
</style></head><body><div class="wrap">
<h1>you-site 后台<small>自托管 · 无 Cookie</small></h1>
<div class="tabs">${tab("today", "今天")}${tab("7d", "近 7 天")}${tab("30d", "近 30 天")}${tab("all", "全部")}</div>

<div class="cards">
  <div class="card"><b>${summary.uv}</b><span>独立访客</span></div>
  <div class="card"><b>${summary.pv}</b><span>访问次数</span></div>
  <div class="card"><b>${avgSec ? avgSec + "s" : "—"}</b><span>平均停留 / 访次</span></div>
  <div class="card"><b>${totalMin ? totalMin + "min" : "—"}</b><span>总停留</span></div>
</div>

<h2>每日访问</h2>
<div class="chart">${daily.slice(0, 14).reverse().map((d) =>
      `<div class="c"><div class="b" style="height:${Math.max(4, Math.round((d.pv / maxPv) * 80))}px" title="${esc(d.d)} · ${d.pv}"></div><div class="d">${esc(d.d.slice(5))}</div></div>`).join("") || ""}</div>

<h2>区块触达（看过的人数）</h2>
<table><tr><th>区块</th><th class="num">人数</th></tr>
${rows(sections, (s) => `<tr><td>${esc(s.el)}</td><td class="num">${s.n}</td></tr>`)}</table>

<h2>页面内点击</h2>
<table><tr><th>目标</th><th class="num">次数</th></tr>
${rows(clicks, (c) => `<tr><td>${esc(c.el)}</td><td class="num">${c.n}</td></tr>`)}</table>

<h2>外链转化</h2>
<table><tr><th>去向</th><th class="num">次数</th></tr>
${rows(outbound, (o) => `<tr><td class="new">${esc(o.el)}</td><td class="num">${o.n}</td></tr>`)}</table>

<h2>最近访问</h2>
<table><tr><th>时间</th><th>来源 / 设备</th><th>地区</th><th class="num">停留</th></tr>
${rows(recent, (r) => {
      const t = new Date(r.ts + 8 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
      const dev = r.w < 600 ? "手机" : r.w < 1024 ? "平板" : "桌面";
      const ref = r.ref ? esc(r.ref) : "直接打开";
      const dw = r.dwell_ms >= 60000 ? Math.round(r.dwell_ms / 60000) + "min" : r.dwell_ms > 0 ? Math.round(r.dwell_ms / 1000) + "s" : "—";
      return `<tr><td class="num">${t}</td><td>${ref} · ${dev}</td><td>${esc(r.country || "—")}</td><td class="num">${dw}</td></tr>`;
    })}</table>

<p class="mut" style="margin-top:40px">uhash 仅当日去重 · 不存 IP / Cookie · 换 key：<code>npx wrangler secret put ADMIN_KEY</code></p>
</div></body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return new Response("admin error: " + esc(String(e)), { status: 500 });
  }
}
