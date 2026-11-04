# 改版布局与文案规格（v2）

> 服务端渲染（`seo/render.js`）和客户端视图（`public/js/views/*`）都按这份规格实现。类名两边共用，样式由客户端侧的 CSS 定义。
> 原则：一个屏只回答一个问题；所有数字必须带标签、区间、样本量或置信度；没有数据就写「暂无」，不推断。

## 首页 `/`（`/en/`）

区块顺序（首屏必须包含 1–3）：

1. **结论台** `.verdict`
   - `<p class="verdict-eyebrow">`：`CODEX 额度追踪` / `CODEX QUOTA TRACKER`
   - `<h1>`：`Codex 今天会重置吗？` / `Will Codex reset today?`
   - `<p class="verdict-answer">` 一句话结论（模板见下），是整站的主答案句
   - `.verdict-grid` 内：
     - `.verdict-number[data-confidence=high|medium|low]` ×2
       - `.verdict-value`：`19%`（大数字，24h 第一个）
       - `.verdict-label`：`未来 24 小时` / `未来 48 小时`
       - `.verdict-range`：`区间 16–32%`（没有区间时显示 `样本不足`）
     - `dl.verdict-facts` 三个 `.fact`：
       - `最近一次已确认重置` → `10月28日 14:35`（访问者时区）+ `<p>距今 7.0 天</p>`
       - `已等待` → `7.0 天` + `<p>比 70% 的历史间隔更长 · 中位 3.3 天</p>`
       - `下一次高频窗口` → `08:00–11:00`（访问者时区）+ `<p>UTC 00:00–03:00 · 占样本 20%</p>`
   - `<p class="verdict-note">`：`概率来自本站台账上的历史节奏模型（样本 60 个间隔，置信度 高），不代表 OpenAI 的承诺。` / 英文对应
   - `data-confidence` 决定颜色：high 用绿，medium 用琥珀，low 用灰。数字旁必须有文字标签说明置信度。

2. **节奏摘要** `<section class="leaf" id="rhythm-preview">`
   - `.leaf-head`：`<h2>重置节奏</h2>` + `.leaf-note`：`所有已确认重置之间的间隔，以及一天里最常发生重置的时段。`
   - 内容：
     - `.factgrid` 三个事实：`间隔中位数` `3.3 天`；`最近 8 次中位` `2 天`；`最长间隔` `67.7 天`
     - `.heatmap`（结构见下）
     - `.leaf-foot` → `<a class="chit" href="/rhythm">查看完整节奏</a>`

3. **最近记录** `<section class="leaf">`
   - `<h2>最近的重置记录</h2>`，表格/列表 6 条：`日期时间`（访问者时区）、`类型`（`重置` / `备用额度`）、`来源`（外链 `X 原帖 ↗`，没有来源就写 `台账记录`）
   - 底部链接 `查看全部记录` → `/timeline`

4. **方法与数据** `<section class="leaf">`
   - 2–3 句话：数据来自我们自己的公开台账（每条都能追到一条 X 原帖）；概率是本地算的历史节奏；并链到 `/status` `/rhythm` `/about`。
   - 三个 guide 链接（沿用现有 `guideSection`）。

## 新页面 `/rhythm`（`/en/rhythm`）

1. `.page-head`：`<h1>重置节奏</h1>` + `<p class="lead">`
   - lead：`把每一次已确认重置放到同一条时间轴上：间隔多久、落在星期几的几点、下一条最可能出现在哪个窗口。全部由本站台账在本地计算。`
2. `.leaf`「节奏概况」→ `.factgrid`：`已记录重置`（61 次）、`覆盖跨度`（406 天）、`间隔中位数`（3.3 天）、`最近 8 次中位`（2 天）
3. `.leaf`「间隔分布」→ `.chart-host`（客户端画 SVG；SSR 输出 `.data-table` 的间隔表：`# | 重置时间 | 距上一次`，最多 40 行 + 「最近 60 个间隔」
4. `.leaf`「星期 × 小时」→ `.heatmap` + `.window-list`（前 5 个三小时窗口：`UTC 00:00–03:00 · 12 次 · 20%`）
5. `.leaf`「按月」→ `.data-table`：月份 / 重置 / 备用额度（最近 12 个月）
6. `.leaf`「这个数字怎么算的」→ 方法与参数（半衰期 60 天、Weibull 形状参数、经验权重、自助重采样 400 轮、回测 Brier + 基线）+ FAQ（3 条）

### `.heatmap` 结构（两边一致）

```html
<div class="heatmap" role="img" aria-label="重置发生时段：UTC 小时 × 星期，共 61 次">
  <div class="heatmap-grid">
    <span class="heatmap-corner" aria-hidden="true"></span>
    <span class="heatmap-hour" aria-hidden="true">00</span> … 24 个
    <span class="heatmap-day">周一</span>
    <span class="heatmap-cell" data-level="0|1|2|3|4" title="周一 00:00 UTC · 1 次"></span> … 24 个
    … 7 行
  </div>
  <p class="heatmap-legend">周一为第一行；列是 UTC 小时。颜色越深表示该时段重置次数越多。</p>
</div>
```

`data-level` 按 `count / max` 分档：0 = 0 次，1 = ≤25%，2 = ≤50%，3 = ≤75%，4 = >75%。

## `/status` → 「数据状态」

1. `.page-head`：`<h1>数据状态</h1>` + lead：`这个站只有一个数据源：仓库里的公开台账。这里说明它更新到什么时候、覆盖了哪些时间、哪里还有缺口，以及模型的自带回测。`
2. `.leaf`「数据新鲜度」→ `.factgrid`：`台账更新时间`、`距今`（`0.3 小时`）、`状态`（`新鲜` / `过期`，阈值 168 小时）、`事件总数`（72）
3. `.leaf`「覆盖范围」→ `首次记录` / `最近重置` / `重置次数` / `备用额度次数` / `跨度`
4. `.leaf`「已知缺口」→ 表格：`从` / `到` / `间隔天数`（>30 天的间隔），没有就写 `没有超过 30 天的缺口`
5. `.leaf`「自检」→ `.check-list`：每条 `名称` + `通过/失败` + `说明`
6. `.leaf`「模型」→ 参数表（半衰期 60 天、min gap 6 小时、经验混合伪计数 12、自助 400 轮、Brier/基线）
7. `.leaf`「数据来源」→ 来源列表 + 口径说明（只收公开可追溯事件；不声称监测账号；不抓第三方接口）

## `/plan` → 「28 天计划复盘（已结束）」

- title：`Codex 28 天计划复盘：Day 1–28 已结束的完整记录`
- h1：`Codex 28 天计划复盘：Day 1–28`
- lead：`2026 年 10 月 5 日到 11 月 1 日，Tibo 连续 28 天发布更新或重置。活动已经结束，这一页冻结成复盘：哪几天是重置、哪几天是产品更新、哪几天没有公开记录。`
- `.verdict`（或 `.plan-hero`）里放状态徽标：`已结束 · 2026-11-01`
- `.factgrid`：`活动窗口`（10月5日 – 11月1日）、`有记录`（22 / 28 天）、`其中重置`（14 次）
- 原表格保留（Day / 日期（PT）/ 当天内容 / 状态），状态列的 `未收录` 改为 `无公开记录`
- 表格下方 `.leaf`「结束后看什么」：`活动结束后不再有每日更新，站点改为持续跟踪重置节奏：` + 链接 `/rhythm`、`/timeline`
- FAQ 更新三问：这个计划是什么 / 之后还有每日更新吗（没有，28 天已结束）/ 为什么有的天没有内容
- 导航里不再有它；页脚放 `28 天复盘`。

## `/vigil`（一起等重置）

沿用现有结构：§ 计数（`此刻有 N 人一起等`）、§ 墙、§ 睡眠时钟（重置小时分布）、§ 档案。
新增：`加入这面墙` — 一个输入名字（1–24 字）+ 可选已等天数（0–365）的表单，`POST /api/pray`，成功后把名字插到墙里；失败显示「现在无法保存，稍后再试」。
计数和墙来自 `GET /api/pray`；amen（`+1`）用 `POST /api/pray/amen {id}`。

## 导航与页脚

- 主导航（`nav.main`）：`概览` `/` · `重置节奏` `/rhythm` · `重置记录` `/timeline`
- 页脚：`重置记录` `/timeline` · `重置节奏` `/rhythm` · `数据状态` `/status` · `一起等重置` `/vigil` · `28 天复盘` `/plan` · `关于` `/about` · `源码` · 三个 guide 链接 · 外部：`@thsottiaux`
- 页脚数据来源行：`数据来源：本站公开台账（X 原帖可追溯）` / `Source: this site's own ledger, every row traceable to a public post`
- 顶部状态 chip（`#status-chip`）：显示数据状态 `新鲜` / `过期`（`过期` 用琥珀），链接 `/status`；不再显示 OpenAI 服务状态。

## 文案红线

- 不出现「上游」「监控账号」「OpenAI Status」「实时抓取」。
- 不出现「保证」「一定会」「官方预测」。
- 概率句必须带样本量或置信度；区间缺失时明确写「样本不足」。
- 时区：窗口按 UTC 计算并标 `UTC`；具体时间按访问者时区显示并标时区名。
