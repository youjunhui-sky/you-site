-- you-site 自托管匿名统计 · D1 schema v1
-- 埋点四类：visit 进入 / sec 区块曝光 / click 页内点击 / out 外链点击 / hb 心跳(10s 一次，封顶 12 个)
CREATE TABLE IF NOT EXISTS events (
  ts      INTEGER NOT NULL,             -- epoch ms
  sid     TEXT    NOT NULL,             -- 会话 id（sessionStorage 随标签页）
  type    TEXT    NOT NULL,             -- visit|sec|click|out|hb
  el      TEXT,                         -- 目标标识：区块 id / 按钮 / 外链
  ms      INTEGER,                      -- hb 心跳间隔毫秒
  ref     TEXT,                         -- 来源域（t.co / x.com / google...）
  country TEXT,                         -- CF 边缘解析的 ISO 国家码
  w       INTEGER,                      -- 视口宽
  h       INTEGER,                      -- 视口高
  ua      TEXT,                         -- user-agent 前 180 字
  uhash   TEXT    NOT NULL,             -- sha256(ip|ua|date) 前 16 位，当日去重
  eid     INTEGER PRIMARY KEY AUTOINCREMENT
);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, ts);
CREATE INDEX IF NOT EXISTS idx_events_sid  ON events(sid);
