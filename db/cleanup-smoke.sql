-- cleanup: 删除冒烟测试噪音（sid 为纯数字 run id；真实浏览器 sid 是带连字符的 UUID/hex 随机）
DELETE FROM events WHERE sid NOT LIKE '%-%';
