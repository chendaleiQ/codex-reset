'use strict';
/**
 * Editorial pages.
 *
 * Four questions people actually type into a search box, answered once each in
 * Chinese and English. The dashboard tracks the numbers; these pages explain
 * what the numbers mean, which is the part no API can hand you.
 *
 * Content rules: nothing here may contradict the OpenAI help centre, no pricing
 * is quoted, and every page ends by pointing back at the live records.
 */

const UPDATED = '2026-10-28';

const ARTICLES = {
  'codex-reset': {
    zh: {
      title: 'Codex 额度重置是什么？5 小时限额、备用额度与全局重置的区别',
      description:
        'Codex 的三类额度重置分别是什么、多久发生一次、怎么查自己的剩余额度和下次重置时间，以及 Tibo 宣布的全局重置和账号里的备用额度有什么不同。',
      h1: 'Codex 额度重置是什么？三类重置的区别',
      lead: '「Codex 重置了」在不同语境里指三件不同的事：你的 5 小时窗口到期、你账号里的一次备用额度、或者 OpenAI 给所有人发的一次全局重置。分清楚这三件事，才能判断网上看到的「重置」和你有没有关系。',
      sections: [
        {
          h2: '一、5 小时窗口自动重置：最常发生，也最容易被误会',
          paragraphs: [
            '付费方案下的 Codex 额度按 5 小时滚动窗口计算。窗口从你发出第一条请求开始计时，5 小时后整体刷新，期间未用完的额度不会结转到下一个窗口。',
            '所以「重置」在大多数时候指的是这个自动到期的窗口，而不是一次额外的赠送。它是持续发生的，和今天有没有人宣布重置无关。',
          ],
          list: [
            '窗口是滚动的：每个人的起点不同，重置时间也不同。',
            '窗口到期时额度回到上限，不累积。',
            '5 小时之外还有一层每周额度，两个限制分别计算，先到先停。',
          ],
        },
        {
          h2: '二、备用额度（banked reset）：可以自己决定的额外一次',
          paragraphs: [
            '备用额度是 OpenAI 单独发放的一次性重置。它不会自动生效，需要你在设置里手动使用：桌面端和网页版在「设置 → 用量」里选择用量摘要中显示的可用重置次数，CLI 里输入 /usage 后选择 Redeem reset。',
            '使用一次完整重置会同时刷新 5 小时窗口和每周额度，并改变每周额度的重置时间点。它属于「存着不用也不会消失得太快、但最好别浪费」的资源，具体的有效期以你账号里显示的信息为准。',
          ],
        },
        {
          h2: '三、全局重置：所有人一起收到的那一种',
          paragraphs: [
            'OpenAI 团队会不定期对所有用户统一重置额度，通常由 Codex 负责人 Tibo（@thsottiaux）在 X 上宣布。这类重置没有固定节奏，可能因为故障补偿、产品发布或者活动安排而出现，也可能连续几天出现。',
            '这类消息在传播中最容易失真：有人把预告当成已生效，有人把局部实验当成全员重置。本站的做法是把「公告」「待确认」「已确认」分开展示，并在时间线上按发生日期归档，而不是把它们都算成一次重置。',
          ],
        },
        {
          h2: '四、怎么查自己下一次重置是什么时候',
          paragraphs: [
            '最准确的位置是你的账号本身：桌面端或网页版的「设置 → 用量」，或者 CLI 里的 /usage，会给出当前窗口的剩余比例与到期时间。',
            '本站提供的是另一层信息：全局重置的历史与概率、以及「现在离上一次全局重置过了多久」。把账号里的到期时间和这里的全局记录放在一起看，就能分辨「是我自己的窗口到期」还是「今天全站真的重置了」。',
          ],
        },
      ],
      faq: [
        {
          q: 'Codex 重置是每天都有的吗？',
          a: '自己的 5 小时窗口每天都在反复重置，这是常态。全站范围的重置没有固定周期，历史上从几天一次到两周以上一次都出现过；本站的日历记录的是后者。',
        },
        {
          q: '为什么公告说重置了，我的额度没有变？',
          a: '三种可能：公告仍处于「待确认」阶段、你的账号属于未覆盖的批次或方案、或者只是 5 小时窗口刚好先到期。先看账号里「设置 → 用量」的数值，再对照本站时间线上的确认状态。',
        },
        {
          q: '备用额度会自动用掉吗？',
          a: '不会。备用额度需要手动使用，不点就不会消耗；它也不会阻止 5 小时窗口照常滚动。',
        },
      ],
      related: ['codex-5-hour-limit', 'codex-banked-reset'],
      sources: [
        { label: 'OpenAI Help Center：Codex 重置如何运作', url: 'https://help.openai.com/zh-hans-cn/articles/20001498-how-resets-work-in-codex' },
        { label: 'Tibo（@thsottiaux）在 X 上的公开动态', url: 'https://x.com/thsottiaux' },
      ],
    },
    en: {
      title: 'What Is a Codex Reset? 5-Hour Limits, Banked Resets and Global Resets',
      description:
        'The three different things people mean by “Codex reset”: the rolling 5-hour limit, a banked reset you redeem yourself, and a global reset announced by Tibo. How to tell which one you got.',
      h1: 'What is a Codex reset? The three things people mean',
      lead: '“Codex reset” refers to three different events: your own 5-hour window expiring, a banked reset you redeem manually, or a global reset OpenAI grants to everyone. Knowing which one you are looking at decides whether an announcement on X affects your account at all.',
      sections: [
        {
          h2: '1. The rolling 5-hour window — the reset that happens all day',
          paragraphs: [
            'On paid plans, Codex usage is metered in a 5-hour rolling window. The window starts with your first request and refreshes five hours later; unused allowance does not carry over into the next window.',
            'Most of the time, “reset” simply means this automatic expiry. It happens continuously and has nothing to do with whether anyone announced anything today.',
          ],
          list: [
            'The window is rolling, so everyone’s reset time is different.',
            'Allowance returns to the cap; it never accumulates.',
            'A separate weekly allowance runs alongside the 5-hour window. Whichever is exhausted first stops you.',
          ],
        },
        {
          h2: '2. A banked reset — the extra one you redeem yourself',
          paragraphs: [
            'A banked reset is a one-off reset OpenAI grants to your account. It does not apply automatically: open Settings → Usage on desktop or web and pick the available reset shown on your usage summary, or run /usage in the CLI and choose Redeem reset.',
            'A full reset renews both the 5-hour and weekly allowances and shifts the weekly reset time. Treat it as a stored resource with an expiry shown in your account — not something to hoard indefinitely.',
          ],
        },
        {
          h2: '3. A global reset — the one everyone gets',
          paragraphs: [
            'From time to time OpenAI resets limits for all users at once, usually announced by Codex lead Tibo (@thsottiaux) on X. There is no fixed cadence: it can follow an incident, a launch, or an event, and it has happened on consecutive days.',
            'This is also where misinformation spreads fastest — a teaser gets reported as a landed reset, a limited test as a global one. This site separates announced, pending and verified records, and files each one by the date it actually happened.',
          ],
        },
        {
          h2: '4. Finding your own next reset',
          paragraphs: [
            'Your account is the authority: Settings → Usage on desktop or web, or /usage in the CLI, shows the remaining allowance and when the current window ends.',
            'This site adds the other half: the history and probability of global resets, and how long it has been since the last one. Read together, you can tell “my window simply expired” from “everyone really did get a reset today”.',
          ],
        },
      ],
      faq: [
        {
          q: 'Does Codex reset every day?',
          a: 'Your own 5-hour window resets several times a day — that is normal. Site-wide resets are irregular: the gap has ranged from consecutive days to a fortnight or more. The calendar here tracks the site-wide kind.',
        },
        {
          q: 'An announcement says limits were reset, but my quota did not change. Why?',
          a: 'Usually one of three reasons: the announcement is still pending rather than confirmed, your plan or batch was not covered, or your own 5-hour window happened to expire first. Check Settings → Usage, then compare with the confirmation state on the timeline.',
        },
        {
          q: 'Are banked resets used automatically?',
          a: 'No. A banked reset must be redeemed manually and is never consumed in the background. It also does not stop the 5-hour window from rolling as usual.',
        },
      ],
      related: ['codex-5-hour-limit', 'codex-banked-reset'],
      sources: [
        { label: 'OpenAI Help Center: How resets work in Codex', url: 'https://help.openai.com/en/articles/20001498-how-resets-work-in-codex' },
        { label: 'Tibo (@thsottiaux) on X', url: 'https://x.com/thsottiaux' },
      ],
    },
  },

  'codex-5-hour-limit': {
    zh: {
      title: 'Codex 5 小时限额怎么算？什么时候重置、怎么查剩余额度',
      description:
        'Codex 的 5 小时限额与每周额度分别怎么计算、从什么时候开始计时、什么时候重置，以及在哪里查看剩余额度，并说明限额和全局重置的关系。',
      h1: 'Codex 5 小时限额怎么算？',
      lead: 'Codex 的额度不是一个整天固定的数字，而是「5 小时窗口 + 每周额度」两层限制。搞明白计时方式，比等一次全局重置更有用。',
      sections: [
        {
          h2: '两层限制：5 小时窗口和每周额度',
          paragraphs: [
            '第一层是 5 小时滚动窗口：从一个窗口里的第一次使用开始计时，5 小时后刷新。这一层决定了你能不能连续高强度工作一整个下午。',
            '第二层是每周额度：以周为单位结算，决定你这周总共能用多少。两层是「先到先停」的关系——任何一层用完，都得等它自己刷新，除非有备用额度或全局重置。',
          ],
        },
        {
          h2: '重置时间怎么算：跟着你的第一次使用走',
          paragraphs: [
            '5 小时窗口不是一个全站统一的整点，而是从你本次窗口的第一次请求开始计算。这意味着重置时间取决于你自己的使用习惯：早上 9 点开工和下午 2 点开工，重置时间相差 5 小时。',
            '窗口到期不会「补发」你没用完的部分，额度直接回到上限。所以把用量摊平，比在窗口末尾冲刺更划算。',
          ],
        },
        {
          h2: '什么在消耗额度',
          paragraphs: [
            'Codex 的每一种入口都算在同一份额度里：CLI、网页版、IDE 扩展和桌面应用，只要用的是同一个账号，消耗的就是同一份 5 小时窗口和每周额度。',
            '不同任务消耗差别很大：一次只改几行的请求和一次长时间自主运行的代理任务，成本完全不在一个量级。想把额度用久一点，通常应该从任务粒度入手，而不是换入口。',
          ],
        },
        {
          h2: '在哪里看剩余额度',
          paragraphs: [
            '桌面端和网页版：设置 → 用量，能看到当前窗口的剩余比例与到期时间。',
            'CLI：输入 /usage，同样会给出当前用量和窗口信息，还可以在这里使用备用额度。',
            '第三方工具（包括本站）只能看到公开的全局重置信号，看不到你账号里的具体余量——任何声称能读到个人余额的第三方站点都值得怀疑。',
          ],
        },
        {
          h2: '限额和「重置」的关系',
          paragraphs: [
            '日常的 5 小时窗口到期属于正常刷新，不是新闻。真正值得关注的是 OpenAI 主动发起的全局重置：它会把所有人的额度直接拉满，并且通常意味着之后几天的额度会更宽裕。',
            '本站的概览页会同时给出「最近一次已确认全局重置」和「未来 24 / 48 小时重置概率」，时间线页则保留每一次记录，方便你判断这次「重置」是不是真的。',
          ],
        },
      ],
      faq: [
        {
          q: '5 小时限额是每天重置几次？',
          a: '窗口是滚动的，一天里理论上可以刷新多次，具体次数取决于你什么时候开始使用、以及中间有没有停够 5 小时。它不是每天固定时间重置一次。',
        },
        {
          q: '用完 5 小时额度后，每周额度会一起没吗？',
          a: '不会。两层分开计算，5 小时窗口到期后额度恢复；只有当每周额度也耗尽时，才需要等周额度刷新或使用备用额度。',
        },
        {
          q: '切换账号或者换设备能重置额度吗？',
          a: '额度跟着账号走，不跟着设备走。换设备不会带来新额度，换账号则是另一份额度，属于不同的订阅关系。',
        },
      ],
      related: ['codex-reset', 'codex-banked-reset'],
      sources: [
        { label: 'OpenAI Help Center：Codex 重置如何运作', url: 'https://help.openai.com/zh-hans-cn/articles/20001498-how-resets-work-in-codex' },
        { label: 'OpenAI Status：服务状态', url: 'https://status.openai.com/' },
      ],
    },
    en: {
      title: 'Codex Usage Reset: How the 5-Hour Limit Works and When It Resets',
      description:
        'How Codex meters usage across a rolling 5-hour window and a separate weekly allowance, when each one resets, where to check what is left, and why a global reset is different.',
      h1: 'Codex usage reset: how the 5-hour limit works',
      lead: 'Codex usage is not one daily number. It is two layers — a rolling 5-hour window and a weekly allowance — and knowing how each one is clocked is more useful than waiting for a global reset.',
      sections: [
        {
          h2: 'Two layers, whichever runs out first',
          paragraphs: [
            'The first layer is a rolling 5-hour window: it starts with your first request inside that window and refreshes five hours later. This is what decides whether you can work at full tilt all afternoon.',
            'The second layer is a weekly allowance, settled per week, which caps what you can spend in total. Whichever layer is exhausted first stops you until it refreshes — unless you have a banked reset or a global reset lands.',
          ],
        },
        {
          h2: 'When the window resets: it follows your first request',
          paragraphs: [
            'The 5-hour window is not a site-wide clock. It starts with your own first request, so your reset time depends on your own habits — starting at 9am and starting at 2pm put the reset five hours apart.',
            'Unused allowance is not carried over: when the window expires the allowance returns to the cap. Spreading work out beats sprinting at the end of a window.',
          ],
        },
        {
          h2: 'What consumes the allowance',
          paragraphs: [
            'Every Codex surface draws from the same pool: CLI, web, IDE extensions and the desktop app all count against the same 5-hour window and weekly allowance when signed into the same account.',
            'Task shape matters more than entry point. A request that edits a few lines and a long autonomous agent run are not remotely the same cost. If you want the allowance to last, change the task granularity, not the client.',
          ],
        },
        {
          h2: 'Where to check what is left',
          paragraphs: [
            'Desktop and web: Settings → Usage shows the remaining share of the current window and when it ends.',
            'CLI: run /usage for the current figures, and to redeem a banked reset.',
            'Third-party tools — including this one — can only see public global-reset signals, never your personal balance. Any third-party site claiming to read your private quota deserves suspicion.',
          ],
        },
        {
          h2: 'How the limit relates to a “reset”',
          paragraphs: [
            'Your 5-hour window expiring is routine, not news. What is worth tracking is a global reset initiated by OpenAI: it tops everyone up at once and usually means roomier limits for the following days.',
            'The overview page shows the last verified global reset and the 24h/48h probability of the next, while the timeline keeps every record so you can check whether a “reset” really happened.',
          ],
        },
      ],
      faq: [
        {
          q: 'How many times a day does the 5-hour limit reset?',
          a: 'The window rolls, so it can refresh several times a day depending on when you start using it and whether you leave five hours between sessions. There is no single fixed daily reset time.',
        },
        {
          q: 'If the 5-hour allowance runs out, does the weekly allowance go too?',
          a: 'No. They are metered separately. The 5-hour window refills when it expires; only an exhausted weekly allowance forces you to wait for the weekly refresh or redeem a banked reset.',
        },
        {
          q: 'Can I reset the quota by switching accounts or devices?',
          a: 'Quota follows the account, not the device. A new device gets you nothing; a different account is a different subscription and therefore a different allowance.',
        },
      ],
      related: ['codex-reset', 'codex-banked-reset'],
      sources: [
        { label: 'OpenAI Help Center: How resets work in Codex', url: 'https://help.openai.com/en/articles/20001498-how-resets-work-in-codex' },
        { label: 'OpenAI Status', url: 'https://status.openai.com/' },
      ],
    },
  },

  'codex-banked-reset': {
    zh: {
      title: 'Codex 备用额度（banked reset）怎么用？会不会过期',
      description:
        'Codex 备用额度是什么、在哪里使用、用掉一次会重置哪些限制、会不会过期，以及它和 OpenAI 全员重置、和 5 小时窗口自动刷新的区别。',
      h1: 'Codex 备用额度（banked reset）怎么用',
      lead: '备用额度是账号里存着的一次性重置。它不会自动生效，也不会自动过期作废——但需要你自己去用。',
      sections: [
        {
          h2: '备用额度是什么',
          paragraphs: [
            '备用额度（banked reset）是 OpenAI 发放给账号的一次性重置，和 5 小时窗口的自动刷新是两件事。它存在你的账号里，等你在需要的时候手动使用。',
            '常见的来源包括官方补偿、活动发放，以及订阅方案里附带的额度。不同来源的额度在界面上的措辞可能不同，例如「1 次可用重置」或「完整重置」。',
          ],
        },
        {
          h2: '在哪里使用',
          paragraphs: [
            '桌面端和网页版：打开「设置 → 用量」，找到显示可用重置次数的用量摘要，点开后会看到到期信息，确认即可使用。',
            'CLI：输入 /usage，选择 Redeem reset。',
            '使用前界面会显示到期时间，建议先看一眼再决定现在用还是留着。',
          ],
          list: [
            '一次完整重置会刷新 5 小时窗口和每周额度。',
            '使用后每周额度的重置时间点会跟着改变。',
            '额度不会在后台自动被消耗。',
          ],
        },
        {
          h2: '会不会过期',
          paragraphs: [
            '备用额度带到期时间，具体日期以账号里显示的为准。它不是永久资产，但也不是每天清零的日抛额度。',
            '实用建议：当每周额度已经见底、又还有明确的产出任务时使用；如果这周本来就快结束，留着更划算。',
          ],
        },
        {
          h2: '和其它两种「重置」的区别',
          paragraphs: [
            '和 5 小时窗口：窗口到期是自动的、免费的、天天发生；备用额度是手动的一次性资源。',
            '和全员重置：全员重置是 OpenAI 主动对所有账号发起的，你无法触发；备用额度是你自己决定何时使用。两者可以叠加，先全员重置再留备用额度通常最划算。',
          ],
        },
      ],
      faq: [
        {
          q: '备用额度不用会消失吗？',
          a: '会到期，但不是立刻消失。账号里会显示具体的到期时间，只要在到期前使用即可。',
        },
        {
          q: '用掉备用额度会改变每周重置时间吗？',
          a: '会。使用一次完整重置会刷新 5 小时窗口和每周额度，每周额度的重置时间点也随之移动。',
        },
        {
          q: '为什么我的设置里没有「可用重置」？',
          a: '备用额度不是每个账号、每个时间点都有。没有显示通常意味着当前没有可用额度，或者你的方案不包含这一项。',
        },
      ],
      related: ['codex-reset', 'codex-5-hour-limit'],
      sources: [
        { label: 'OpenAI Help Center：Codex 重置如何运作', url: 'https://help.openai.com/zh-hans-cn/articles/20001498-how-resets-work-in-codex' },
      ],
    },
    en: {
      title: 'Codex Banked Resets: How to Redeem One and Whether They Expire',
      description:
        'What a banked Codex reset is, where to redeem it, which limits it renews, whether it expires, and how it differs from a global reset and from the rolling 5-hour window.',
      h1: 'Codex banked resets, explained',
      lead: 'A banked reset is a one-off reset stored in your account. It never applies by itself, and it does not vanish overnight — but you do have to redeem it.',
      sections: [
        {
          h2: 'What a banked reset is',
          paragraphs: [
            'A banked reset is a single-use reset granted to your account by OpenAI. It is a different mechanism from the rolling 5-hour window: it sits in your account until you choose to spend it.',
            'Grants come from incident compensation, promotions and some plan allowances. The wording varies — “1 reset available”, “Full reset” — but the mechanics are the same.',
          ],
        },
        {
          h2: 'Where to redeem it',
          paragraphs: [
            'Desktop and web: open Settings → Usage, select the usage summary showing an available reset, review the expiry and confirm.',
            'CLI: run /usage and choose Redeem reset.',
            'The dialog shows the expiry first, so you can decide whether to spend it now or keep it.',
          ],
          list: [
            'A full reset renews both the 5-hour window and the weekly allowance.',
            'Redeeming shifts the weekly reset time.',
            'It is never consumed in the background.',
          ],
        },
        {
          h2: 'Do they expire?',
          paragraphs: [
            'Yes — banked resets carry an expiry date, shown in your account. They are not permanent assets, and they are not daily disposables either.',
            'Practical rule: redeem one when the weekly allowance is spent and you still have real work to ship. If the week is nearly over anyway, keeping it is usually worth more.',
          ],
        },
        {
          h2: 'How it differs from the other two “resets”',
          paragraphs: [
            'Versus the 5-hour window: that one is automatic, free and constant; a banked reset is manual and finite.',
            'Versus a global reset: a global reset is initiated by OpenAI for every account and you cannot trigger it; a banked reset is yours to time. They stack — letting a global reset land first and keeping the banked one in reserve is usually the best order.',
          ],
        },
      ],
      faq: [
        {
          q: 'Does an unused banked reset disappear?',
          a: 'It expires rather than disappearing instantly. Your account shows the exact expiry date; redeem before it passes.',
        },
        {
          q: 'Does redeeming one change my weekly reset time?',
          a: 'Yes. A full reset renews the 5-hour and weekly allowances, and the weekly reset time moves with it.',
        },
        {
          q: 'Why is there no “reset available” in my settings?',
          a: 'Not every account has one at every moment. If nothing is shown, there is usually no available grant right now, or your plan does not include one.',
        },
      ],
      related: ['codex-reset', 'codex-5-hour-limit'],
      sources: [
        { label: 'OpenAI Help Center: How resets work in Codex', url: 'https://help.openai.com/en/articles/20001498-how-resets-work-in-codex' },
      ],
    },
  },
  'codex-quota-run-out': {
    zh: {
      title: 'Codex 额度用完了怎么办？三层限制的判断顺序',
      description:
        'Codex 额度用完时，先分清是 5 小时窗口、每周额度还是服务故障，再决定等窗口、用备用额度还是等全局重置；附上让额度撑得更久的几种做法。',
      h1: 'Codex 额度用完了怎么办？',
      lead: '同样是「用不了」，原因可能是三种不同的限制。判断对了，处理方式完全不同——有的只需要等两个小时，有的是这一周的额度真的见底了。',
      sections: [
        {
          h2: '一、先分清卡在哪一层',
          paragraphs: [
            '第一层是 5 小时滚动窗口：从你在这个窗口里的第一次请求开始计时，5 小时后自动恢复。大多数「突然不能用了」都是这一层，等一等就好。',
            '第二层是每周额度：按周结算，用完就要等周额度刷新。它和 5 小时窗口分开计算，把 5 小时窗口等到也不一定能继续用。',
            '第三层其实不是额度问题：如果报错是限流、超时或服务异常，先去看 OpenAI Status 的服务状态，再考虑额度。',
          ],
          list: [
            '桌面端或网页版：设置 → 用量，能看到当前窗口的剩余比例与到期时间。',
            'CLI：输入 /usage，同时给出当前用量和窗口信息。',
            '本站的服务状态页把 Codex 各入口的官方状态和重置记录放在一起，方便对照。',
          ],
        },
        {
          h2: '二、三种立刻能做的事',
          paragraphs: [
            '等窗口：最稳、零成本，代价是时间。把不着急的活挪到窗口刷新之后，通常比反复重试划算。',
            '用备用额度：账号里有可用重置时，可以在「设置 → 用量」里手动使用，或者在 CLI 里输入 /usage 选择 Redeem reset。一次完整重置会同时刷新 5 小时窗口和每周额度。',
            '等全局重置：OpenAI 会不定期对所有人统一重置。本站首页给出最近一次已确认重置和未来 24 / 48 小时的概率，概率是公开信号与历史节奏的推算，不是承诺。',
          ],
        },
        {
          h2: '三、让额度撑得更久的四个做法',
          list: [
            '把任务拆小：一次只改几行的请求，和长时间自主运行的代理任务，消耗完全不在一个量级。',
            '控制上下文：反复把大文件读进上下文会显著增加消耗，先定位再读。',
            '别在窗口末尾冲刺：窗口到期会重新给满，临近到期时把重活留到下一个窗口更划算。',
            '减少无效重试：同一个失败任务连着重试，往往比换一个更小的尝试更费。',
          ],
        },
        {
          h2: '四、什么时候该考虑换方案',
          paragraphs: [
            '如果一周里多次在窗口内用完，说明使用强度已经超出当前方案，靠等窗口和备用额度只是拖时间。这时候值得对比更高一档的方案，或者把一部分工作交给成本更低的模型。',
            '如果只是偶尔一次，等窗口或等一次全局重置通常就够了——不必为偶发的峰值升级。',
          ],
        },
      ],
      faq: [
        {
          q: '额度用完会立刻恢复吗？',
          a: '不会。5 小时窗口要等到它自己到期才恢复，未用完的部分也不会结转。每周额度同理，要等周额度刷新。',
        },
        {
          q: '备用额度能救急吗？',
          a: '能，但需要你手动使用：设置 → 用量里选择可用重置，或 CLI 里 /usage 选择 Redeem reset。它不会在后台自动生效。',
        },
        {
          q: '等全局重置和现在升级，哪个划算？',
          a: '看频率。偶发一次用完，等窗口或等一次全局重置就够了；如果每周都在等，说明额度本身不够，升级或拆分任务更实际。',
        },
      ],
      related: ['codex-reset', 'codex-5-hour-limit'],
      sources: [
        { label: 'OpenAI Help Center：Codex 重置如何运作', url: 'https://help.openai.com/zh-hans-cn/articles/20001498-how-resets-work-in-codex' },
        { label: 'OpenAI Status：服务状态', url: 'https://status.openai.com/' },
      ],
    },
    en: {
      title: 'Codex Quota Ran Out? Which Limit Actually Stopped You',
      description:
        'When Codex runs out of quota, work out whether it is the 5-hour window, the weekly allowance or a service incident — then decide whether to wait, redeem a banked reset or watch for a global reset.',
      h1: 'Codex quota ran out — what now?',
      lead: '“I can’t use it” can mean three different things. Getting the layer right changes the answer completely: one of them is a two-hour wait, another is a weekly allowance that is genuinely spent.',
      sections: [
        {
          h2: '1. Work out which layer stopped you',
          paragraphs: [
            'The first layer is the rolling 5-hour window: it starts with your first request inside that window and refills five hours later. Most “it suddenly stopped working” cases are this layer, and waiting is the whole fix.',
            'The second layer is the weekly allowance. It is metered separately, so waiting out the 5-hour window does not give you more if the week is already spent.',
            'The third case is not a quota problem at all: if the error mentions rate limiting, timeouts or a service incident, check OpenAI Status before you assume it is your allowance.',
          ],
          list: [
            'Desktop or web: Settings → Usage shows the remaining share and when the window ends.',
            'CLI: /usage returns the same figures, plus the redeem control.',
            'This site’s status page pairs each Codex surface’s official state with the reset records.',
          ],
        },
        {
          h2: '2. Three things you can do right now',
          paragraphs: [
            'Wait for the window. Free and reliable; the only cost is time. Moving non-urgent work past the refresh usually beats retrying.',
            'Redeem a banked reset. If your account has one, open Settings → Usage and use the available reset, or run /usage in the CLI and choose Redeem reset. A full reset renews both the 5-hour window and the weekly allowance.',
            'Watch for a global reset. OpenAI resets everyone from time to time; the overview page shows the last verified reset and the 24h/48h probability — an estimate from public signals and history, not a promise.',
          ],
        },
        {
          h2: '3. Four ways to make the allowance last longer',
          list: [
            'Shrink the tasks: a request that edits a few lines and a long autonomous agent run are not the same cost at all.',
            'Control context: re-reading large files into context adds up — locate first, then read.',
            'Do not sprint at the end of a window: the window refills anyway, so heavy work is better placed after the refresh.',
            'Avoid blind retries: hammering the same failing task usually costs more than a smaller second attempt.',
          ],
        },
        {
          h2: '4. When to change plan instead of waiting',
          paragraphs: [
            'If you hit the wall several times a week, your usage has outgrown the plan and waiting only buys time. That is the point to compare the next tier, or to move part of the work to a cheaper model.',
            'If it happens once in a while, waiting for the window or a global reset is enough — do not upgrade for a one-off spike.',
          ],
        },
      ],
      faq: [
        {
          q: 'Does quota come back immediately?',
          a: 'No. The 5-hour window has to expire, and unused allowance does not carry over. The weekly allowance works the same way.',
        },
        {
          q: 'Can a banked reset cover the gap?',
          a: 'Yes, but you have to redeem it yourself: Settings → Usage shows an available reset, or run /usage in the CLI and choose Redeem reset. It never applies in the background.',
        },
        {
          q: 'Is it cheaper to wait for a global reset or upgrade now?',
          a: 'Check the frequency. An occasional dry spell is worth waiting out; if you wait every week, the plan is too small and splitting the work or upgrading is the real fix.',
        },
      ],
      related: ['codex-reset', 'codex-5-hour-limit'],
      sources: [
        { label: 'OpenAI Help Center: How resets work in Codex', url: 'https://help.openai.com/en/articles/20001498-how-resets-work-in-codex' },
        { label: 'OpenAI Status', url: 'https://status.openai.com/' },
      ],
    },
  },

  'codex-reset-alert': {
    zh: {
      title: '怎么第一时间知道 Codex 重置了？三种提醒方式对比',
      description:
        'Codex 重置没有固定时间，靠隔一会儿刷一次 X 很容易错过。对比三种提醒方式：本站浏览器通知、关注 Tibo 的 X 账号、第三方转发机器人，以及各自适合谁。',
      h1: '怎么第一时间知道 Codex 重置了？',
      lead: '全局重置往往在很短时间内被用掉。与其隔一会儿刷一次，不如让提醒来找你。',
      sections: [
        {
          h2: '一、为什么值得专门设一个提醒',
          paragraphs: [
            '重置公告出现和额度真正生效之间通常只有很短的时间差，而额度是先到先得的体验：早半小时知道，就多半小时的窗口。',
            '重置又没有固定时间表——可能来自故障补偿、产品发布或活动，历史上从连续几天到两周以上一次都出现过。靠猜不如靠通知。',
          ],
        },
        {
          h2: '二、本站的浏览器通知',
          paragraphs: [
            '打开本站，点页头右上角的铃铛按钮，浏览器询问通知权限时选择允许，按钮状态变成「已开启」即可。之后检测到新的重置公告会弹出通知。',
            '限制要说清楚：本站是只读镜像，没有服务端推送，通知由页面自己的轮询触发。所以需要这个页面在浏览器里保持打开（可以放在后台标签页）；关掉浏览器或设备休眠时不会响。',
            '适合：工作时本来就开着这个页面的人。免费、不用注册、不收集账号信息。',
          ],
        },
        {
          h2: '三、关注原始信息源',
          paragraphs: [
            '绝大多数重置来自 Codex 负责人 Tibo（@thsottiaux）在 X 上的帖子。关注他并打开账号通知，是最直接的方式，也比任何转发都早。',
            '代价是噪音：他的账号同时发布产品更新和日常动态，重置只占其中一部分。',
          ],
        },
        {
          h2: '四、第三方转发',
          paragraphs: [
            '社区里有把重置公告转发到 Telegram、Discord 或企业微信的机器人，适合团队统一接收。',
            '要注意时延和可靠性：转发链路多一跳，可能更慢；上游接口一变，转发也可能悄悄停掉。把它当作补充而不是唯一来源。',
          ],
        },
        {
          h2: '五、怎么组合最省事',
          paragraphs: [
            '个人：本站通知 + 关注 Tibo 账号，两个都免费，覆盖「页面开着」和「不在电脑前」两种场景。',
            '团队：一个人盯本站并把消息转到群里，比每个人都开一遍通知更高效。',
          ],
        },
      ],
      faq: [
        {
          q: '本站的通知需要注册账号吗？',
          a: '不需要，也不会上传任何账号信息。通知只在你的浏览器本地授权和存储。',
        },
        {
          q: '关掉网页还会收到提醒吗？',
          a: '不会。通知依赖页面自身的轮询，页面关掉或设备休眠时不会响。这是只读镜像的固有限制，我们没有隐瞒这一点。',
        },
        {
          q: '重置一般什么时候发生？',
          a: '没有固定时间。历史记录可以在重置记录页和按月归档里查看，用来判断最近的节奏比平时更密还是更疏。',
        },
      ],
      related: ['codex-reset', 'codex-quota-run-out'],
      sources: [
        { label: 'Tibo（@thsottiaux）在 X 上的公开动态', url: 'https://x.com/thsottiaux' },
        { label: 'OpenAI Status：服务状态', url: 'https://status.openai.com/' },
      ],
    },
    en: {
      title: 'How to Get Notified When Codex Resets (Three Options Compared)',
      description:
        'Codex resets have no schedule, so refreshing X every few minutes loses. Compare browser notifications from this site, following Tibo on X, and third-party relay bots — and who each one suits.',
      h1: 'How to get notified when Codex resets',
      lead: 'A global reset gets used up fast. Instead of refreshing, let the alert come to you.',
      sections: [
        {
          h2: '1. Why an alert is worth setting up',
          paragraphs: [
            'The gap between an announcement and the reset landing is short, and the quota experience is first come, first served: knowing half an hour earlier is half an hour more window.',
            'There is no schedule either — resets have come from incident compensation, launches and events, with gaps ranging from consecutive days to a fortnight or more. Guessing is worse than being told.',
          ],
        },
        {
          h2: '2. Browser notifications from this site',
          paragraphs: [
            'Open the site and press the bell in the top-right of the header, then allow notifications when the browser asks; the button switches to “on” and new announcements raise a notification.',
            'The limitation, stated plainly: this is a read-only mirror with no server-side push, so alerts fire from the page’s own polling. Keep the page open in a background tab — nothing fires if the browser is closed or the device is asleep.',
            'Best for: people who keep the page open while working. Free, no account, no personal data collected.',
          ],
        },
        {
          h2: '3. Follow the source',
          paragraphs: [
            'Almost every reset originates in a post by Codex lead Tibo (@thsottiaux) on X. Following the account with notifications on is the earliest signal there is.',
            'The cost is noise: product updates and day-to-day posts arrive on the same feed, and resets are only part of it.',
          ],
        },
        {
          h2: '4. Third-party relays',
          paragraphs: [
            'Community bots forward reset announcements to Telegram, Discord or enterprise chat, which suits a team that wants one shared feed.',
            'Watch the latency and the upkeep: every relay adds a hop, and an upstream API change can quietly stop it. Treat a relay as a supplement, not the only source.',
          ],
        },
        {
          h2: '5. What to combine',
          paragraphs: [
            'Individually: this site’s notification plus following Tibo covers both “at the desk” and “away from the machine”, and both are free.',
            'As a team: one person watches and forwards to the group chat — cheaper than everybody enabling alerts separately.',
          ],
        },
      ],
      faq: [
        {
          q: 'Do I need an account for the notifications?',
          a: 'No. Nothing is uploaded; the permission and the preference live in your browser only.',
        },
        {
          q: 'Will I get alerts with the page closed?',
          a: 'No. Alerts depend on the page polling, so closing the browser or sleeping the device stops them. That is a hard limit of a read-only mirror, and the interface says so.',
        },
        {
          q: 'When do resets usually happen?',
          a: 'They do not follow a clock. The reset history and the monthly archive show whether the current cadence is denser or sparser than usual.',
        },
      ],
      related: ['codex-reset', 'codex-quota-run-out'],
      sources: [
        { label: 'Tibo (@thsottiaux) on X', url: 'https://x.com/thsottiaux' },
        { label: 'OpenAI Status', url: 'https://status.openai.com/' },
      ],
    },
  },

};

const SLUGS = Object.keys(ARTICLES);

/** Locale-neutral path for an article, e.g. `/guide/codex-reset`. */
function articlePath(slug, locale) {
  return locale === 'en' ? `/en/guide/${slug}` : `/guide/${slug}`;
}

function articleMeta(slug, locale) {
  const entry = ARTICLES[slug]?.[locale] ?? ARTICLES[slug]?.zh;
  if (!entry) return null;
  return { slug, locale, updated: UPDATED, ...entry, path: articlePath(slug, locale) };
}

function slugFromPath(pathname) {
  const match = /^(?:\/en)?\/guide\/([a-z0-9-]+)\/?$/.exec(pathname || '');
  if (!match) return null;
  const locale = pathname.startsWith('/en/') ? 'en' : 'zh';
  return ARTICLES[match[1]] ? { slug: match[1], locale } : null;
}

module.exports = { ARTICLES, SLUGS, articleMeta, articlePath, slugFromPath, UPDATED };
