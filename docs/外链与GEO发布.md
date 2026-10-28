# 外链 / GEO 引用源：可以直接发的稿子

目标不是「发广告」，而是**让 AI 答案引擎和搜索引擎在别处看到这个站**。
AI 搜索的引用来源就三块：Google/Bing 索引、自家爬虫库、第三方提及。前两块已经在跑，
这一份解决第三块。

发布顺序按性价比排：X（你的主场）→ linux.do（中文 AI 开发者密度最高）→ Reddit → V2EX。
**规则**：同一天不要全铺；每个地方发完隔 2–3 天再发下一个；被删了不要重发。

---

## 1. X（中文主贴）

> Codex 今天又重置了。
>
> 我做了个站，把 Tibo 的每一次重置都留了档：
> · 最近一次已确认重置 + 未来 24/48 小时概率（10 月 28 日 14:35 北京时间刚重置过）
> · 28 天计划 Day 1–28 逐日对照 —— 哪天是真重置、哪天只是发版，分开标
> · 完整重置记录，北京时间 / 按月归档，共 65 条
> · 顺手写清了 5 小时限额、备用额度到底怎么算
>
> 非官方，纯公开数据，不用登录：
> https://codex-reset.opentunnel.asia/

配图建议：首页截图（日历 + 三个数字）或 `/plan` 的 Day 1–28 表格截图。

## 2. X（英文串，接在中文帖下面或单独发）

> Codex reset again today.
>
> Built a tracker that keeps the receipts:
> · last verified global reset + 24h/48h probability
> · the 28-day run, day by day — which days were real resets vs. just a ship
> · full reset history, 65 records, monthly archive
> · plain-language explainers for the 5-hour limit and banked resets
>
> Unofficial, public data only, no login:
> https://codex-reset.opentunnel.asia/en/

## 3. linux.do（中文，发在「搞七捻三」或「开发调优」）

**标题**：做了个 Codex 重置追踪站，把「公告」和「真的重置了」分开记

**正文**：

> 一直有个痛点：Tibo 发一条「今天会重置」，群里就开始传「重置了」，但实际额度刷没刷是另一回事。
>
> 所以做了个站，核心是把三种状态分开：
> - **公告**：帖子说要重置
> - **待确认**：还没观测到生效
> - **已确认**：监测账号看到额度实际刷新（或有第二个独立来源）
>
> 现在能看到的东西：
> - 概览：最近一次已确认重置、未来 24/48 小时概率（公开信号 + 历史节奏推算，不是官方承诺）
> - 重置记录：完整时间线，北京时间，按月归档，能看到两次重置隔了几天
> - 28 天计划：Tibo 的 Day 1–28 逐日对照，哪天是重置、哪天只是产品更新
> - 服务状态：Codex 各入口的官方状态，故障后有没有跟着来一次重置
>
> 另外写了三篇说明，避免每次都在群里重复回答：5 小时窗口怎么滚、备用额度怎么用会不会过期、额度用完了按什么顺序处理。
>
> 非官方项目，只读公开数据，不登录、不收集账号信息，也读不到任何人的个人额度。
>
> https://codex-reset.opentunnel.asia/
>
> 有错的地方欢迎指出来，尤其是「某天到底算不算重置」这种判定，我会改。

**注意**：linux.do 对自我推广比较敏感，正文里不要出现「求支持」「收藏」，最好真回答别人的问题再附链接。

## 4. Reddit（英文，r/OpenAI 或 r/codex 的回帖优先，不要直接发广告帖）

**Reply 版（在别人问 "did codex reset today" 的帖子里）**：

> The reliable signal is Tibo's own feed (@thsottiaux) — he announces most global resets there.
> Two things worth knowing: a "reset announced" is not the same as a landed reset, and your own
> 5-hour window expiring is not a global reset at all.
>
> I keep a tracker that separates announced / pending / verified, plus the full history and the
> 28-day run day by day: https://codex-reset.opentunnel.asia/en/
> Unofficial, no login, no account data.

**自荐帖版（r/SideProject 更合适）**：

> **I built a tracker for Codex quota resets that separates "announced" from "actually landed"**
>
> Every global Codex reset starts as a post from Tibo on X, and the gap between the announcement and
> the quota actually refreshing is where most confusion comes from. So the tracker records three
> states — announced, pending, verified — and never counts a teaser as a landed reset.
>
> It also keeps the full reset history, a monthly archive, the 28-day run day by day, and Codex
> surface status. Read-only, no login, no personal quota data.
>
> https://codex-reset.opentunnel.asia/en/ — feedback welcome, especially on how I judge edge cases.

## 5. V2EX（中文，节点「程序员」或「分享创造」）

**标题**：分享一个 Codex 额度重置的追踪站（把「公告」和「已确认」分开记）

**正文**：同 linux.do 版本，去掉最口语的部分，加一句「用 Node 写的，无依赖，服务端渲染」。

---

## 发完之后要回来做的三件事

1. 把发出去的链接**记下来**（哪天、哪个平台、链接），这是后面看 AI 是否引用的基线。
2. 2–3 天后在同一个平台**回一次评论**（有互动的内容更容易被索引和引用）。
3. 一周后查：Google `site:` 是否出现、Bing 是否收录、ChatGPT/Perplexity 问固定问题时是否提到。

## 不要做的事

- 不要一次发五个平台（会被判垃圾）。
- 不要在别人的求助帖里只丢链接不回答问题。
- 不要买外链、不要用互点群。
- 不要改标题反复重发。

---

## 已发布记录

| 日期 | 平台 | 链接 | 状态 |
| --- | --- | --- | --- |
| 2026-10-28 | X（中文主贴 + 英文回复串） | https://x.com/chendaleiQi/status/2115356792477913280 | 已发布 |
| 2026-10-28 | Reddit r/SideProject | https://www.reddit.com/r/SideProject/comments/1xhiez3/i_built_a_tracker_for_codex_quota_resets_that/ | 已发布 |

未发布：V2EX、linux.do（都需要邀请码才能注册/登录）；知乎、即刻可以后续补。

### 后续动作

- 明天回一次 X 帖的评论；Reddit 帖有回复就答，别只丢链接。
- 一周后看：Google `site:` 是否出现、Bing 是否收录、ChatGPT / Perplexity 问固定问题时是否提到。
- 服务器日志里盯 referrer 出现 `x.com` / `t.co` / `reddit.com` 的记录，那是外链真正带来人的证据。
