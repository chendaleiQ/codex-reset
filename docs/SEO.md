## 二、抓取问题已解决（2026-10-28 15:40 完成）

原计划用 Cloudflare 代理，执行时发现一个更底层的问题：**这台阿里云主机的 443 端口对 Cloudflare 边缘入站握手失败（错误 525），和 Googlebot 抓不到是同一个原因**——面向境外大厂网段的入站 TLS 被拦截。Cloudflare 的出站方向反而是通的，所以改用 **Cloudflare Tunnel**：

```
访客 / Googlebot → Cloudflare 边缘（全球）→ 隧道（源站主动外连）→ 源站 nginx:443 → Node 应用
```

已完成的操作：

1. 域名 `opentunnel.asia` 的 NS 已从 `dns31/dns32.hichina.com` 改为 `kia.ns.cloudflare.com` / `kipp.ns.cloudflare.com`，Cloudflare 区域状态 **active**。
2. Cloudflare 里补齐 5 条解析记录：`@`、`www`、`baohu`、`sketchive`（DNS only）与 `codex-reset`（**CNAME → 隧道，已代理**）。
3. 源站安装 `cloudflared` 并注册为 systemd 服务（`/usr/local/bin/cloudflared`，服务名 `cloudflared`），隧道 ID `2dcac739-af3b-461f-9fd8-658c9b585842`，隧道入口指向 `https://127.0.0.1:443`（SNI 保持站点域名，走 nginx）。
4. SSL/TLS 模式 **Full (strict)**、Always Use HTTPS、Brotli 全部打开；边缘证书已签发。
5. **Google 已能抓取**：富媒体搜索结果测试「抓取成功，检测到 1 项有效内容（数据集）」。
6. **Search Console 已通过验证**（HTML 文件 + HTML 标记双方法），`sitemap.xml` 已提交，44 个 URL 已再次推给 IndexNow。

### 运维注意（重要）

- 源站 nginx 仍是 Let's Encrypt 证书，**2027-01-17 到期**。现在续期要走 Cloudflare 的 DNS（不再是阿里云），或者更省事：换成 **Cloudflare Origin CA 证书（15 年）**，装到 nginx 后彻底不用管。
- 隧道服务随机器自启；排查命令：`systemctl status cloudflared`、`journalctl -u cloudflared -n 50`。
- 发布流程没变：GitHub Actions / `npm run deploy` 仍然是改 nginx 后面的 blue-green 容器，Cloudflare 与隧道不用动。
- Cloudflare 免费版会缓存静态资源；HTML 是 `DYNAMIC` 不缓存，发布后立刻生效。

## 三、原计划的 Cloudflare 步骤（留档）

下面这段是最初的接入方案，实际执行时因为上述入站问题改用隧道，步骤留作参考。


推荐 **Cloudflare 免费版**（不换服务器、不动代码）：

1. 注册 Cloudflare，添加站点 `opentunnel.asia`。
2. 到阿里云/万网把域名的 NS 改成 Cloudflare 给的两条 nameserver。
3. Cloudflare DNS 里保留 `codex-reset` 的 A 记录指向 `101.133.168.66`，**代理开关打开（橙色云朵）**。
4. SSL/TLS 模式选 **Full (strict)**（服务器上已有 Let's Encrypt 证书，可直接用）。
5. 打开 `Always Use HTTPS`。

做完以后 Google 看到的是 Cloudflare 的 IP，80 端口由 Cloudflare 边缘处理，备案拦截与抓取不可达的问题一起消失。附带收益：海外访问更快、抗打、证书自动续期。

替代方案：把源站搬到境外（Vercel / Cloudflare Pages / 一台海外 VPS），域名直接解析过去。纯静态托管对这个项目完全够用。

## 四、这次已经做完并上线的改动

线上版本：`20261028T070504Z-76d2c030d865`（commit `6a7c2b0`）。站点结构从「4 个视图 + 空 HTML 壳」变成「44 个服务端渲染的可抓取 URL」。

### 1. 抓取面（之前完全没有）

- 每条路由由服务端输出各自的 `<title>`、`<meta description>`、`canonical`、`hreflang`（zh-Hans / en / x-default）、Open Graph、Twitter 卡片、JSON-LD。
- **首屏正文写进 HTML**：最近一次已确认重置、24/48 小时概率、最近动态、重置记录表、服务状态。不执行 JS 也能读到内容；JS 启动后在原位置接管交互。
- `robots.txt`、`sitemap.xml`（44 个 URL，带 hreflang 与 lastmod）、`llms.txt`。
- 未知路径返回真正的 **404**（之前全部 200 的空壳软 404）；`/index.html`、`/en`、尾斜杠统一 301；`/api/*` 加 `noindex`。
- 结构化数据：`WebSite`、`WebPage`、`Dataset`（开放的重置数据）、`FAQPage`、`Article`、`BreadcrumbList`、`ItemList`。

### 2. 新页面（承接长尾查询）

| 路径 | 目标查询 |
| --- | --- |
| `/plan` | codex 28 天计划 / 28 天更新计划 / 重置日历（Day 1–28 逐日表，数据驱动） |
| `/archive`、`/archive/YYYY-MM` | codex 重置记录 + 月份长尾（按月归档，11 个月 × 中英） |
| `/timeline` | codex 重置记录 / 重置历史 / 北京时间（标题与表头按北京时间定位） |
| `/guide/codex-reset` | codex 重置是什么 / 三类重置的区别 |
| `/guide/codex-5-hour-limit` | codex 5 小时限额 / 额度多久恢复 |
| `/guide/codex-banked-reset` | 备用额度 / banked reset 怎么用、会不会过期 |
| `/en/...` 全套 | 英文侧薄 SERP：`codex usage reset` 等 |

### 3. 其它

- 首页与每个页面底部都有说明区 / 相关阅读，形成内链。
- `og-image.png`（1200×630）社交分享图。
- Search Console 的 HTML 文件与 meta 标记已就位（`google877d75e2becea3b2.html`、`<meta name="google-site-verification">`）。
- IndexNow 密钥文件 `d0142614b0db5dbd2b9d80ebd6972879.txt`，40 个 URL 已提交（202 已接受）。
- 测试：`npm run check:seo` 覆盖 18 条路由、结构化数据、404、重定向；发布验证器改为校验渲染结果。

## 五、接下来要做的事

1. **Search Console**：`https://search.google.com/search-console/` 添加资源 `https://codex-reset.opentunnel.asia/`，两个验证文件已在站点上，直接点「验证」即可通过；然后「站点地图」提交 `sitemap.xml`；再用「网址检查」对首页和 `/plan` 请求编入索引。
2. **Bing Webmaster Tools**：`https://www.bing.com/webmasters` 导入站点，提交 sitemap（IndexNow 已经在推，Bing 首页比 Google 容易进，3–8 周可见）。
3. **外链**：新域名 + 零外链是第二个硬伤。优先做三条：把 GitHub 仓库设为 public 并在 README 首行放站点链接；在 linux.do / V2EX 的相关帖子里自然出现；在 X 上发一条带链接的帖子（这个站的目标用户就在 X）。

## 六、关键词预期（基于 2026-10-28 的 Google 前 10 实测）

**能打的（Cloudflare 接好后 3–6 个月有把握）**

- `codex 28天 更新计划` / `codex 28天 日历` —— 全网没人以 D1–D28 为标题建页，概念独占
- `codex 重置 北京时间` / `codex 什么时候重置 中国时间` —— 本站默认 UTC+8，天然优势
- `codex 重置日历` / `codex 重置记录` / `codex 重置概率` —— 前 10 里有多个无名小站，空缺真实
- `codex usage reset`（英文）—— 实测 SERP 只有 3 条结果，英文侧最薄的口子

**打不动的（别浪费预算）**

- `codex 重置`、`codex 额度重置`、`codex 今天会重置吗`、`codex 重置预测`、`codex reset tracker`：第 1 位是 help.openai.com，2–3 位被 codex-reset.com、opentherank.com、divin.cc 占住，且同类克隆站已有 20+ 个。

**结论**：主词 6 个月内基本无望，长尾可以打。真正的第一步不是内容，是让 Google 能抓到站点。

## 七、运维提醒

- **HTTPS 证书 2027-01-17 到期**，且当前是手动 DNS 验证，不能自动续期。证书一掉，排名会归零。接 Cloudflare 后建议直接切到 Cloudflare 的证书，或给 acme.sh 配 DNS API 自动续期。
- 数据来自 `codex-reset.com` 的公开接口，逐字照抄它原来的标题/描述会被判重复内容——本次已全部改为原创标题与文案。
