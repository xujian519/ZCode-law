---
name: patent-fact-check
description: 事实核验闸门：法条引用先用 `mcp__patent__law_verify` 对照随包法规索引判定，再对法条、判例、对比文件、日期数字四类事实断言做可溯源核验，任一断言无法溯源即不通过（Fail-Closed）。交付前使用。
---

> **工具可用性**：本技能引用的 `mcp__patent__*` 工具随插件分阶段上线（当前仓库移植进行中）。工具未上线时，禁止伪造工具结果；向用户说明该工具未可用，并按技能目标用可用能力降级处理。

# 事实核验

对交付物中每一句事实性断言做可溯源核验。任一断言拿不出可验证来源即整体不通过，打回补证。

## 四类核验

1. 法条：先用 `mcp__patent__law_verify` 过一遍交付物里的每条引用（判为「未核验」或「索引中不存在」的继续查证原文；判为「与所引命题不符」或「条号超出有效范围」的直接改写或删除）。
2. 判例：案号、决定号、裁判要点逐项核对来源（`mcp__patent__patent_case_search` 命中记录或知识图谱节点），标注出处。核验失败 → 不引用。
3. 对比文件：编号（D1/D2…）、公开号、段落 pin-cite、公开日早于申请日/优先权日。文件未打开验证 → 不用于结论。
4. 日期数字：申请日/优先权日/期限用 `mcp__patent__patent_deadlines` 计算，官费与年费金额用 `mcp__patent__patent_fees` 计价，命中数与页码以工具返回为准，禁止心算。`mcp__patent__patent_fees` 拒绝给出合计时（说明书附加费、延长期限请求费两项按分档收费、索引未记金额），该金额属未溯源断言 → 按官方收费标准公告核价或从交付物中删除报价；不得按记忆填一个数。与来源不符 → 回退重算。

## 法条核验的两步（不可合并为一步）

**第一步：`mcp__patent__law_verify` 定形式与索引收录。** 传入待核文本或其引用，读取五种判定：

| 判定 | 后续动作 |
|---|---|
| 已核验 | 与所引命题相符，可用；仍保留其 `sourceDoc`。 |
| 与所引命题不符 | 引用与所述命题不一致 → 改写或删除。 |
| 条号超出有效范围 | 条号超出已核验的条数上限 → 改写或删除。 |
| 索引中不存在 | 索引未收录 → 不得据此推定该条不存在，须查官方原文确认。 |
| 条文未转录（未核验） | 该条目已索引，但条文文本尚未随包转录（《专利审查指南》的节级条目已随包转录，报此判定的只是部分/章一级且其下各节都没有转录的条目）。**这不是通过**，须按第二步查证原文。 |

**第二步：查证原文。** 凡判为「未核验」或「索引中不存在」的引用，按序查证并记录渠道与出处：若本机启用了 cnlaw 法律底座，`mcp__cnlaw__*` 优先（REST 兜底，记 `source_path`）；未启用时直接走兜底通道——`mcp__patent__patent_case_search` / `mcp__patent__patent_wiki_search` → `WebFetch` 打开官方原文。几步都拿不到来源 → 删除或改写该断言。

引用形式（条/款/项、指南节路径）的归一交给 `mcp__patent__law_verify`，不要手工写条号；`mcp__patent__law_verify` 只回答"该条是否在索引内、已转录的条文是否支撑该命题"，不代替对法条原文的查证。

## 核验通道、检索式与引用格式

**cnlaw 条件。** 端点一律取系统提示的 cnlaw 声明段，不要假设端口；该段声明为未启用时不得尝试任何本机端点，直接走右列的兜底通道。

| 需求 | 首选 | 兜底（cnlaw 未启用时） |
|---|---|---|
| 法规条文与《专利审查指南》全文 | `mcp__patent__law_search`：`scope=law` 取律法规条文、`scope=guideline` 取指南全文（命名空间 `审查指南_md/…`），命中返回 `name`/`level`/`sourcePath` 与片段，`sourcePath` 即引文出处 | 若本机启用了 cnlaw：语义检索（见下）→ `WebFetch` 官方原文；未启用：`WebSearch`/`WebFetch` 官方原文 |
| 规则卡片与「规则→法条」关系 | `mcp__patent__patent_kg_query`（`node_type=GuidelineRule` / `Clause`） | `mcp__patent__patent_wiki_search` |
| 判例全文 | `mcp__patent__patent_case_search` | 若本机启用了 cnlaw：判例通道（见下）；未启用：`WebSearch`/`WebFetch` |
| 创造性四步证据包 | 若本机启用了 cnlaw：`mcp__cnlaw__inventive_step`（调用式见 `inventive-step-analysis`） | `inventive-step-analysis` 技能内的回退例程 |
| IPC 定位 | 若本机启用了 cnlaw：`<cnlaw 图谱端点>/api/cnlaw/ipc/sections` 与 `/api/cnlaw/ipc/tree?parent=<IPC 代码>` | WebSearch / 分类号字段 |

**cnlaw 的 REST 面**（仅当本机启用了 cnlaw 法律底座；其 MCP 未覆盖的部分，图谱与案件工具的 MCP 调用式见 `inventive-step-analysis`）：

- 语义检索：`curl -sG "<cnlaw 语义检索端点>/search" --data-urlencode "q=…" --data-urlencode "k=5"`，返回 `{full_name, number, text, status, domain, category, tier, source_path}`。
- 判例按理由/结论/类型定向：`<cnlaw 语义检索端点>/search/decisions`，参数 `q`、`ground`（法条片断，如 `第22条第3款`）、`ipc`（分类前缀，仅决定）、`result`（结论）、`case_type`（复审/无效/民事/行政）、`k`；判决用 `/search/judgments`（`ground` / `result` / `case_type`）。
- 图谱精确集合：`<cnlaw 图谱端点>/api/cnlaw/graph/ground`（`article` / `law` / `ipc` / `k`）与 `/api/cnlaw/graph/patent`（`pn`）。
- 案件决策链：`<cnlaw 图谱端点>/api/cnlaw/case/<案号>`、`…/chain`、`…/similar`（`scenario` / `k`）；写入用 `POST …/case/<案号>/decision`，字段同 MCP 版。

**引用次序与格式。** 检索与引用按权威度排序：法条法规（`tier=1`）→ 审查指南（`tier=2`）→ 判例（`tier=3`，复审无效决定 `/search/decisions`、判决 `/search/judgments`）→ 书籍（`tier=4`，仅作背景说明，不作法规依据）；冲突以高权威为准。每处法条断言必须带 `full_name`（含条号）与 `source_path`；命中为空的检索不得下任何结论，也不得把命中改写成「已核验」。判例引用格式：`<决定号/案号> + <结论> + <法律依据> + <IPC> + <决定要点(若有)> + <source_path>`，来源标注 cnlaw（或实际使用的兜底通道）。

**规则原文不落地。** 法规条文与《专利审查指南》全文一律从外接 IP 知识库与 cnlaw（启用时）取，不在案卷里留本地副本、不凭记忆；cnlaw 不可用时才退回 `mcp__patent__patent_case_search` / `mcp__patent__patent_kg_query` 与 `WebFetch` 官方原文。

## Fail-Closed

- 任何一类存在未溯源断言 → 门禁不过，交付物打回。
- 「索引中不存在」不构成"该条不成立"的依据，只表示本索引没有它：不得用它反推条文。
- 全部通过才允许进入 patent-compliance-review 与交付。
- 本闸门不替代人工复核：交付说明中明示。

## 流程

逐句扫描交付物 → 标注每条事实断言的来源 → 先跑 `mcp__patent__law_verify` 过全部法条引用 → 按上式处理各判定 → 再核判例/对比文件/日期数字 → 记录不通过项 → 补证或删除 → 重核 → 全过放行。
