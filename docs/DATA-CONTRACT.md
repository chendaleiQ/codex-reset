# 数据与接口契约（v2 · 自持数据）

> 这条契约是站点改版后**唯一**的前后端约定。服务端（`server.js` + `lib/`）按它输出，客户端（`public/js/`）与 SSR（`seo/render.js`）按它消费。
> 运行时**不访问任何第三方接口**：数据来自仓库内的 `data/*.json`，模型在 `lib/model.js` 本地计算。

## 1. 仓库数据

### `data/ledger.json`

```jsonc
{
  "schema": 1,
  "updated_at": "2026-11-04T06:00:00Z",   // 台账最后人工更新时间
  "timezone": "UTC",
  "events": [
    {
      "id": "r061",                        // r### = 重置，b### = 备用额度
      "kind": "reset" | "banked",
      "date": "2026-10-27",                // 美国太平洋日期（展示用）
      "at": "2026-10-28T06:35:38.000Z",    // 我们采用的事件时间：有观测取生效时间，否则取宣布时间
      "announced_at": "2026-10-28T02:42:53.000Z",
      "effective_at": null,                // 有观测到生效时间才填
      "state": "confirmed" | "announced",   // confirmed = 已落地；announced = 只看到公开承诺
      "quote": "Day 23/ ...",              // 公开原帖摘录（原文语言，英文为主）
      "source_url": "https://x.com/thsottiaux/status/...",
      "evidence": "public"
    }
  ]
}
```

### `data/posts.json`

28 天活动的冻结档案（活动已结束），供 `/plan` 复盘页使用：

```jsonc
{ "startDate": "2026-10-05", "endDate": "2026-11-01", "days": 28, "ended": true,
  "posts": [ { "at": "...", "zh": "...", "en": "...", "url": "https://x.com/...", "day": 26 } ] }
```

### `data/meta.json`

`{ schema, updated_at, coverage:{first_event,last_event,resets,banked}, sources:[{label,url}], notes }`

## 2. 自建接口（同源 `/api/*`，全部只读，除 `/api/pray` 写入本地文件）

所有接口：`GET`，`content-type: application/json`，`x-robots-tag: noindex`，允许 `?locale=zh|en`（仅影响少量服务端生成的说明文案，客户端不依赖）。失败返回 `4xx/5xx` + `{ error }`。

### `GET /api/forecast`

```jsonc
{
  "updated_at": "2026-11-04T06:00:00Z",
  "mode": "model",                     // model | pending（台账里有 announced 未落到 confirmed 的重置时）
  "pending": null,                     // mode=pending 时: { id, at, quote, source_url }
  "last_reset_at": "2026-10-28T06:35:38.000Z",
  "age_days": 7.31,                    // 距今等待天数（浮点）
  "probabilities": {
    "raw_24h": 0.31, "raw_48h": 0.52,
    "rounded_24h": 31, "rounded_48h": 52,          // 整数百分比
    "range_24h": { "lower": 0.18, "upper": 0.44 }, // 0–1
    "range_48h": { "lower": 0.33, "upper": 0.68 }
  },
  "confidence": "medium",              // high | medium | low
  "confidence_note": "基于 52 个完整间隔，最近一次数据更新在 3 小时前。",
  "model": {
    "name": "renewal-blend", "version": "v1",
    "interval_sample": 52, "effective_sample_size": 28.4,
    "half_life_days": 60, "shape_k": 1.72, "scale_days": 9.4,
    "empirical_weight": 0.42
  },
  "backtest": {
    "method": "walk-forward", "sample_size": 49,
    "brier": 0.148, "baseline_brier": 0.171,
    "better_than_baseline": true
  },
  "cadence": {
    "recent_median_days": 1.5, "recent_sample": 8,
    "weighted_mean_days": 4.2, "overall_median_days": 5.0, "accelerating": true
  },
  "wait": {
    "days": 7.31, "sample": 52, "shorter_share": 0.96,
    "median_days": 5.0, "mean_days": 7.1, "longest_days": 23.0,
    "position": "longer_than_most"
  },
  "window": { "start_hour": 4, "end_hour": 7, "label": "04:00–07:00 UTC", "share": 0.42 },
  "windows": [ { "start_hour": 4, "end_hour": 7, "count": 25, "share": 0.41 } ],
  "evidence": [
    { "code": "intervals", "label_zh": "...", "label_en": "...", "detail_zh": "...", "detail_en": "...", "href": "/rhythm" }
  ]
}
```

### `GET /api/timeline`

```jsonc
{
  "updated_at": "...",
  "events": [ { "id": "r061", "kind": "reset", "date": "2026-10-27",
    "at": "...", "announced_at": "...", "effective_at": null,
    "state": "confirmed", "quote": "...", "source_url": "https://x.com/..." } ],
  "stats": { "reset": 61, "banked": 11, "total": 72 },
  "first_at": "2025-09-17T04:02:52Z",
  "last_reset_at": "2026-10-28T06:35:38.000Z"
}
```

事件顺序：`at` 正序（旧 → 新）。间隔由客户端或 `/api/rhythm` 计算。

### `GET /api/rhythm`

```jsonc
{
  "updated_at": "...",
  "intervals": [ { "at": "2026-10-28T06:35:38.000Z", "days": 1.02 } ],   // 相邻重置间隔，正序
  "heatmap": [[...24], ...7],        // 7 行（周一=0）×24 列（UTC 小时）的重置次数
  "hour": [24 个整数], "weekday": [7 个整数],
  "windows": [ { "start_hour": 4, "end_hour": 7, "count": 25, "share": 0.41 } ],  // 前 5 个三小时窗口
  "months": [ { "month": "2026-10", "resets": 5, "banked": 2 } ],
  "stats": { "resets": 61, "banked": 11, "span_days": 407,
             "median_interval_days": 5.0, "mean_interval_days": 7.1, "longest_interval_days": 23.0 }
}
```

### `GET /api/status` — 本站「数据状态」（不再抓 OpenAI Status）

```jsonc
{
  "updated_at": "...",
  "dataset": { "first_at": "...", "last_reset_at": "...", "reset": 61, "banked": 11, "span_days": 407, "age_hours": 3 },
  "freshness": { "level": "fresh", "age_hours": 3, "threshold_hours": 168 },
  "gaps": [ { "from": "2026-01-01", "to": "2026-03-02", "days": 60 } ],   // 相邻重置 > 30 天
  "sources": [ { "label": "Tibo 公开帖子（X）", "url": "https://x.com/thsottiaux" } ],
  "model": { "name": "renewal-blend", "version": "v1", "backtest": { } },
  "checks": [ { "name": "ledger", "ok": true, "detail": "72 条事件" } ]
}
```

### `GET /api/pray` / `POST /api/pray` / `POST /api/pray/amen`

GET：

```jsonc
{
  "epoch": { "id": "2026-10-27", "started_at": "...", "cycle": 61, "kind": "reset" },
  "believers": 12,
  "wall": [ { "id": "abc", "name": "阿力", "days": 3, "country": "CN", "at": "..." } ],
  "amens": { "abc": 4 },
  "archive": [ { "epoch_id": "2026-10-24", "count": 9, "ended_at": "..." } ],
  "complete": false
}
```

`POST /api/pray` body `{ "name": "1–24 字符", "days": 0–28, "country": "2 字国家码可选" }` → `201 { "ok": true, "entry": {...} }`
`POST /api/pray/amen` body `{ "id": "entry id" }` → `200 { "ok": true, "count": 4 }`
写入落在 `STATE_DIR`（默认 `./state/`，生产挂载 `/root/codex-reset/state`），不写仓库。

### `GET /api/health` 与 `GET /__health`

`/api/health`：`{ ok, generated_at, dataset: { events, updated_at } }`
`/__health`：`{ ok, generated_at, dataset: {...}, release: { id, commit, dirty, sha256 } | null }`

## 3. 页面路由（中英各一套）

| 路径 | 内容 | 客户端视图 |
| --- | --- | --- |
| `/` | 结论台：24/48h 概率 + 区间 + 等待对比 + 下一次高频窗口 + 节奏摘要 + 最近记录 | `views/home.js` |
| `/rhythm` | **新增** 重置节奏：间隔分布、周×小时热力图、最可能窗口、方法说明 | `views/rhythm.js` |
| `/timeline` | 重置记录（原有） | `views/timeline.js` |
| `/status` | 数据状态（原服务状态，改为本站数据覆盖与新鲜度） | `views/status.js` |
| `/vigil` | 一起等重置（本地持久化） | `views/vigil.js` |
| `/plan` | 28 天计划 **复盘（已结束）**，URL 保留 | SSR-only |
| `/archive`、`/archive/YYYY-MM`、`/about`、`/guide/*` | 原有 | SSR-only |
| `/en/*` | 以上英文 | 同 |

导航：`概览 / 重置节奏 / 重置记录` 三项进主导航；`服务状态→数据状态`、`一起等重置`、`关于` 留在页脚。

## 4. 判定口径（必须在页面上出现）

- 重置 = 台账里 `kind=reset` 且 `state=confirmed` 的公开事件；「已宣布未落地」单列，不计入样本。
- 概率 = 自有间隔样本上的**更新过程**估计：Weibull 拟合与经验生存率按有效样本量加权，区间由自助重采样给出 10–90 分位。
- 等待天数 = 现在 − 最近一次 confirmed 重置时间；「比 x% 的历史间隔更长」用同一份间隔样本。
- 时区：所有概率、窗口按 UTC 计算并标注；页面时间按访问者时区渲染。
- 数据缺口：不填补、不推断，`/status` 明示覆盖与缺口。

## 5. 禁止事项

- 不得再出现 `codex-reset.com`、`status.openai.com` 的运行时请求或「上游」措辞。
- 不得声称「我们监测账号」之类我们并不具备的能力；台账只收公开可追溯来源。
- 每个数字必须带标签与口径（区间/置信度/样本量）。
