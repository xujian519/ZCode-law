---
name: inventive-step-analysis
description: 创造性（A22.3）三步法的证据搜集例程：若本机启用了 cnlaw 法律底座，调用其 inventive_step 工具，从本地权威语料（3万+ 无效/复审决定、专利审查指南、based_on 图谱）拉取「最接近现有技术 D1 / 区别特征 / 实际解决的技术问题 / 有无技术启示」四步的可溯源证据包，每步带 source_path + 法条/指南引用；未启用时按技能内回退例程用插件检索/知识工具搜集同等证据。供创造性论证与 OA 答复直接引用。做 A22.3 评估 / 创造性论证 / 答复审查意见 / 无效答辩需找判例依据时使用。
---

> **工具可用性**：本技能引用的 `mcp__patent__*` 工具随插件分阶段上线（当前仓库移植进行中）。工具未上线时，禁止伪造工具结果；向用户说明该工具未可用，并按技能目标用可用能力降级处理。

# 创造性三步法 · 证据搜集（可溯源例程）

推理（三步法怎么判）归 `patent-novelty-inventiveness`；本 skill 只解决**证据从哪来、怎么引用**——把「复审委在相似发明上怎么认定区别特征 / 技术问题 / 技术启示」的既有裁判，连同审查指南依据，一起取回来并落到可溯源引用。**先取证据，再下结论；每步结论必须能挂回 source_path。**

## 0. 输入与输出
- **输入**：权利要求 / 技术方案描述、目标 IPC（推荐）、（可选）已知 D1 公开号。
- **输出**：四步证据包，每步含若干条可引用证据：
  - **closest_prior_art**：最接近现有技术 D1 候选（同领域、公开特征多）
  - **distinguishing**：区别特征 —— 复审委对同类发明的创造性认定（`based_on` 第22条第3款的判例）
  - **technical_problem**：实际解决的技术问题 —— 《专利审查指南》第二部分第四章 + 判例表述
  - **inventive_step**：有无技术启示 —— 同领域「维持（有创造性）vs 无效（无创造性）」对比
- 每条证据：`case_number/发明名称 + 法条 reference + source_path + citation_verified`。

## 1. 例程步骤

**若本机启用了 cnlaw 法律底座（其 MCP 工具，如 `mcp__cnlaw__inventive_step`）：**

1. **取证据包**：调用 `mcp__cnlaw__inventive_step(claim=<技术方案>, field=<IPC前缀>, k=<每步条数,默认5>)`。IPC 尽量给全（用 ipc 树 `<cnlaw 图谱端点>/api/cnlaw/ipc/sections` 与 `.../tree?parent=<IPC 代码>`（如 H01M）定位，端点取系统提示的 cnlaw 声明段），证据才精准。
2. **按步吃透**：对每步，先看 `excerpt`（判例/指南片段），再用 `WebFetch` 打开 `source_path` 对应的原文核验（本地路径同样可直接读），**不信摘要**。
3. **标引用**：论证里每步的论断，挂上对应证据的 `case_number + 法条/指南 + source_path`。`citation_verified=false` 的条目标注「来源待核」，不得当作确证引用。
4. **补强/筛掉**：若某步证据不足（如技术问题缺指南表述），用 `mcp__cnlaw__graph_ground(article=专利法第22条第3款, ipc=<领域>)` 补 `based_on` 判例，或 `mcp__cnlaw__case_similar(scenario)` 找相似审理场景；按专利号追它的 `involves` 决定/判决用 `mcp__cnlaw__graph_patent(pn=<公开号>)`。这些工具的 REST 兜底形式，以及 cnlaw 的其它面（语义检索、判例定向、案件决策链），见 `patent-fact-check` 技能。
5. **可选落审计链**：把四步各记一条 `mcp__cnlaw__case_record(case_id, category=<区别特征与技术问题|技术启示|结论>, reasoning=<该步论证链>, source_paths=<证据路径>)`，串成可审计决策链（case_get/case_chain 读回）。

**未启用 cnlaw 法律底座时，按以下回退例程搜集同等证据（目标不变：四步可溯源，每步结论挂回 source_path）：**

1. **取 D1 候选**：用 `mcp__patent__patent_search`（关键词/布尔检索）+ `mcp__patent__patent_metadata` 核著录项，按「同领域、公开特征最多、技术问题最接近」遴选最接近现有技术 D1 候选；IPC 用 `mcp__patent__patent_search` 的分类号字段或 WebSearch 辅助定位。
2. **区别特征与创造性认定判例**：用 `mcp__patent__patent_case_search` 按技术关键词 + IPC 检索相似无效/复审决定，取合议组对同类发明「区别特征 / 实际解决的技术问题」的认定表述；用 `mcp__patent__patent_kg_query` 沿知识图谱查规则卡片与裁判规则。
3. **技术问题的指南依据**：用 `mcp__patent__law_search`（scope=guideline 取《专利审查指南》第二部分第四章相关节）取「实际解决的技术问题」的指南表述，`sourcePath` 即引文出处。
4. **技术启示对比**：用 `mcp__patent__patent_case_search` 分别检索同领域「维持（有创造性）」与「无效（无创造性）」决定，做对比；公开日与决定号用 `mcp__patent__patent_metadata` / `WebFetch` 打开官方原文核验，**不信摘要**。
5. **补强/筛掉**：某步证据不足时，回到 `mcp__patent__patent_search` / `WebSearch` 补外部通道，或把该步如实标注「证据不足」。外部通道的执行细节见 `patent-prior-art-search` 技能。
6. **每条引用**：挂上 `case_number/发明名称 + 法条/指南 + source_path`；无法溯源的条目标注「来源待核」，不得当作确证引用。

## 2. 硬规则
- **每步证据必须带 source_path**；无来源的论断不得写入断言（`citation_verified`=False 如实标注）。
- **引用不得凭记忆**：法条引文（第22条第3款等）以证据包的 `reference`/指南原文为准；「维持/无效结论」与判例 `decision_result` 一致。
- **检索未到即声明**：某步无证据 → 列出「该步未检索到确证判例」，不得据空检索下创造性结论（走 `patent-prior-art-search` 补外部通道）。
- **IPC 未给或给错** → 证据跨领域，标注「领域未限定，证据仅供参考」。

## 3. 复用要点（跨场景）
- **OA 答复 / 审查意见**：对审查员引用的 D1，取 `distinguishing` 步的既有裁判，论证「区别特征 + 实际解决的技术问题」不被现有技术启示。
- **无效答辩**：用 `inventive_step` 步的「维持 vs 无效」对比，支撑主张或反驳对方的显而易见指控。
- **检索先于结论**：证据包（本地判例）与 `patent-prior-art-search`（外部通道）互为补充——本地判例给「论证范式」，外部给「确证对比文件」，两者都取再下结论。

## 4. 证据门禁
交付前逐条核对：每条引用 `case_number + 法条/指南 + source_path` 三者齐备、`citation_verified` 为真（或明示待核）、无编造判例号/公开号。缺证据附录视为未完成（交 `patent-quality-gate` 复核）。
