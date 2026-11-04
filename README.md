# Codex Reset

追踪 OpenAI Codex 的额度重置：最近一次已确认的全局重置、未来 24/48 小时重置概率与区间、重置节奏（间隔分布 / 星期×小时热力图 / 高发窗口）、完整重置记录，以及 28 天计划的结束复盘。中文为主，英文在 `/en/` 下。

**线上地址：<https://codex-reset.opentunnel.asia/>**

> 个人项目，与 OpenAI 无关。只读公开数据：不登录任何账号，也读不到任何人的个人额度。

## 为什么做这个

Tibo（[@thsottiaux](https://x.com/thsottiaux)）会用 X 帖子宣布 Codex 的全局额度重置。问题是「宣布」和「真的生效」之间经常有时间差，而「我的 5 小时窗口到期了」又和「全局重置」完全是两件事。

所以这个站把状态拆开记录，并且**只用自己的台账**：

| 状态 | 含义 |
| --- | --- |
| announced 已宣布 | 帖子里说了要重置，还没落地 |
| confirmed 已确认 | 有观测到生效，或有第二个独立来源 |
| banked 备用额度 | 发放而不是立刻消耗的重置，单独记，不混进预测样本 |

不会把一条预告当成已经发生的重置。

## 自持数据，不调别人的接口

v2 起站点不再请求任何第三方 API（旧版整站数据来自 `codex-reset.com` 的公开接口）。现在：

- **台账在仓库里**：`data/ledger.json`（每条事件都能追到一条公开 X 原帖）、`data/posts.json`（28 天活动冻结档案）、`data/meta.json`。
- **模型在本地算**：`lib/model.js` 用「Weibull 更新过程 + 经验生存率」混合估计，按等待时长给条件概率，区间来自种子固定的自助重采样，并自带 walk-forward 回测（Brier 对基线）。方法、参数、回测分数都显示在 `/rhythm` 与 `/status`。
- **接口也是自己的**：`server.js` 只提供同源 `/api/forecast|timeline|rhythm|status|health|pray`，没有任何代理。
- **唯一的写入**：`/vigil` 的祈祷墙落在 `$STATE_DIR/vigil.json`（生产挂载 `/root/codex-reset/state`），不进发布包。

数据更新是人工的：把新事件补进 `data/ledger.json` 并更新 `updated_at`，然后发布。没有后台抓取，也就没有「上游挂了全站空白」这回事。

## 页面

| 路径 | 内容 |
| --- | --- |
| `/` 概览 | 一句话结论 + 24/48 小时概率与区间 + 等待对比 + 下一次高频窗口 + 节奏摘要 + 最近记录 |
| `/rhythm` 重置节奏 | 间隔分布、星期×小时热力图、前五个高发窗口、按月统计、方法与回测 |
| `/timeline` 重置记录 | 重置间隔、分类筛选、时区切换、可排序的历史记录 |
| `/status` 数据状态 | 台账新鲜度、覆盖范围、已知缺口、自检、模型参数与回测、数据来源 |
| `/vigil` 一起等重置 | 本地持久化的等待墙、历史重置时段、常见问题 |
| `/plan` 28 天复盘 | 已结束的 Day 1–28 完整对照（冻结档案，保留原 URL） |
| `/archive` 按月归档 | 每月一页的重置记录 |
| `/about` 关于 | 数据来源、判定口径、更新方式、已知限制 |
| `/en/*` | 以上页面的英文版 |

## 技术结构

- **零依赖、无构建**：Node 18+ 直接运行，静态资源就是 HTML / CSS / 原生 JS。
- **服务端渲染**：每个路由输出各自的 `<title>`、`description`、`canonical`、`hreflang`、Open Graph 与 JSON-LD，首屏正文直接写进 HTML，不执行 JS 也能读到内容。
- **数据分层**：`data/`（事实）→ `lib/model.js`（推断）→ `lib/data.js`（快照）→ `server.js`（接口 + SSR）。
- **部署**：推送到 `main` 后由 GitHub Actions 检查、构建镜像、blue-green 切换并核对公网版本；也可 `npm run deploy` 手动发布。见 [DEPLOY.md](DEPLOY.md)。
- **SEO / GEO**：`robots.txt`、`sitemap.xml`、`llms.txt`、结构化数据（`Dataset` / `FAQPage` / `Article` / `Organization`）、面向答案引擎的「快速回答」段落。细节见 [docs/SEO.md](docs/SEO.md)。

```bash
npm start            # http://localhost:4173
npm run check        # 语法、台账校验、模型边界、接口载荷、祈祷墙存储、禁止外部依赖
npm run check:server # HTTP 路由、自建 API、写入与只读隔离、异常请求
npm run check:seo    # 可抓取路由、robots、sitemap、结构化数据、404 与跳转
npm run check:deploy # 发布验证器
```

## 数据来源与口径

- 来源：Tibo 的公开 X 帖子（`@thsottiaux`），每条台账事件带原帖链接；备用额度只收有公开来源的发放记录。
- 时间默认按北京时间（UTC+8）展示，可切换时区；概率与窗口按 UTC 计算并标注。
- 概率是历史节奏的推算，**不代表 OpenAI 的承诺**；样本量、置信度、区间与回测结果一并显示。
- 活动日（Day 1–28）按美国太平洋时间编号，活动已于 2026-11-01 结束。

## 许可

[MIT](LICENSE)。欢迎指出判定口径上的错误——尤其是「某天到底算不算一次重置」这类边界情况。
