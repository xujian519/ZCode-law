# 专利域工具目录（移植 spec）

- 工具总数：**60**（DSH 侧 12 个包注册；权威源 `docs/tool-catalog.md` 与 `patent-tools/src/wiring.ts`）
- 暴露面：插件 MCP server（id `patent`）→ 模型可见名 **`mcp__patent__<tool>`**
- 入参/出参契约：随源码迁入，schema 以源实现为准；本文档管「名单、分组、LLM 反转、门禁、阶段」

## 命名与引用改写

- 工具注册名保持源名（如 `rule_check`），MCP 暴露名由运行时加前缀成 `mcp__patent__rule_check`。
- 技能与 agents 正文中的工具引用一律改写为 `mcp__patent__*` 全名（Phase 1 一次性改写，Phase 7 核对）。
- 通用文书工具 `list_doc_templates`/`render_doc_template`/`document_deliver`（DSH 的 doc-template/document-deliver 包）不在专利 preset 挂载清单内；本域**不搬**，ZCode 侧有 pdf-plugin 等等价通路，如需再立项。

## LLM 语义反转清单

DSH 中工具体内直接/间接调用 LLM 的，按下表处理（判据见 inventory D 节：`wiring.ts:383-431` 组合点）：

| 工具 | DSH 依赖 | ZCode 处理 |
|---|---|---|
| `claim_chart_build` | 直接（要素拆分映射由模型做） | 拆两步：模型按技能指令产出要素映射 JSON → `claim_chart_build` 改为接收结构化输入做确定性判定（infringement 四态/invalidity 单篇全覆盖）与 pin-cite 校验。接口变化记入实现注释 |
| `patent_analysis_report` | 直接（模型补新颖性/技术强度分） | 模型补分改为技能编排；工具保留确定性特征抽取/IPC/评分基线，模型分以可选入参传入 |
| `triz_contradiction_analysis` | 直接（矛盾识别） | 同上：模型识别矛盾对 → 工具做矩阵落格与参数缺口判定（落格本身已是确定性） |
| `patent_workflow_run` | 直接（LLM atom 执行） | **保留为编排内核**：manifest 执行器仍在工具内，但 LLM atom 不再内部调模型——atom 执行改为「返回待模型完成的阶段作业（stage brief）」，由技能驱动模型完成后以 `resumeCheckpointId`+阶段产出回灌继续执行。确定性 atom（time-baseline/prior-art-filter/citation-check/grounds/coverage 等）原样执行 |
| `flexible_plan` | 直接（run 阶段同 workflow） | 同 `patent_workflow_run` |
| `analyze_patent_figure` | 直接（多模态） | 模型视觉分析步骤移出工具；工具保留索引写入/核对类确定性部分，图像理解由技能用模型完成 |
| `patent_teams_*`（12 个） | 间接（成员是 LLM 子代理） | teams 不搬（裁决 T1）；若 P6 落地薄层，子代理 spawn 走 ZCode subagent 通道 |
| `recognize_chemical_structure` | 设计依赖（当前构建本就不可用，恒 `needHumanReview=true`） | 原样迁入该退化行为 + 明确错误说明；不补引擎 |

其余工具全部确定性，原样迁入。`patent_workflow`（recap 收口）本就无 LLM。

## 工具分组与迁入阶段

### 检索/数据（8）— P4

| 工具 | 来源包 | 用途 | 外部依赖 |
|---|---|---|---|
| `patent_search` | patent-tools | Google Patents 关键词/布尔检索 | 网络（nuo 引擎）；CNIPR 第二通道 |
| `patent_metadata` | patent-tools | 按公开号抓著录项 | 网络（nuo，LRU 缓存） |
| `patent_legal_status` | patent-tools | 批量法律状态与预估届满 | 网络（nuo；CNIPR 重查中国号） |
| `patent_pdf_download` | patent-tools | 批量下载全文 PDF | **ego-browser**（Google Patents 通道）；CNIPR 直链；CDN 兜底 |
| `patent_case_search` | patent-tools | 本地判例 FTS 检索 | knowledge.db |
| `patent_kg_query` | patent-tools | 知识图谱节点查询 | knowledge.db |
| `patent_wiki_search` | patent-tools | wiki 知识卡片检索 | knowledge wiki 目录 |
| `search_patent_figure` | patent-tools | 已分析附图索引检索 | 附图索引文件 |

### 知识/法条（2）— P3

| 工具 | 来源包 | 用途 | 外部依赖 |
|---|---|---|---|
| `law_search` | patent-tools | 法规/审查指南全文检索 | knowledge.db（指南节随包转录） |
| `law_verify` | patent-law | 法条引用逐条判定（已核验/不符/未判定/超范围/不存在/未转录） | 随包法条索引；cnlaw 声明段 |

### 规则/门禁（4）— P3

| 工具 | 来源包 | 用途 | 备注 |
|---|---|---|---|
| `rule_check` | patent-tools | 确定性规则检查（黑名单/模式/结构/引用域/同义/引文重复） | 规则资产随包 |
| `patent_eval` | patent-tools | 产出质量评估（五模式结构化评分） | 确定性 IR 指标 |
| `patent_worker_validate` | patent-tools | worker 产出按契约校验 | 无 |
| `evaluate_evidence` | patent-tools | 证据三性判定 + 类型特定形式要件 | 证据规则资产 |

### 期限/费用（2）— P3

| 工具 | 来源包 | 用途 | 外部依赖 |
|---|---|---|---|
| `patent_deadlines` | patent-deadline | 法定期限/指定期限计算（节假日顺延） | 随包法规与工作历 |
| `patent_fees` | patent-fees | 官费逐项计价（未核验项拒给合计） | 随包费用索引 |

### 撰写/校验（6）— P2 库 / P5 工具

| 工具 | 来源包 | 用途 | 备注 |
|---|---|---|---|
| `draft_claims` | patent-tools | 权利要求书草案（模板组装，确定性） | max_claims 承载项数上限指令 |
| `draft_specification` | patent-tools | 说明书五部分草案（模板组装，确定性） | |
| `validate_specification` | patent-tools | 说明书确定性校验（五部分/标题集合/附图引用/名称摘要长度/覆盖矩阵） | 校验键：heading_set/section_order/figure_mark_parentheses/figure_number_spacing/paragraph_numbering/abstract_heading |
| `parse_office_action` | patent-tools | 审查意见通知书确定性解析 | |
| `matter_log_append` | patent-tools | `_matter-log.md` 只追加（见 matter-state.md） | 案件目录 |
| `knowledge_note_save` | patent-tools | 知识笔记落盘（幂等） | 99-知识库 目录 |

### 分析（3）— P5（LLM 反转）

| 工具 | 用途 | 反转后职责 |
|---|---|---|
| `patent_analysis_report` | 分析报告（特征抽取/IPC/评分） | 确定性基线 + 可选模型分入参 |
| `claim_chart_build` | 权利要求对照表（5 种 mode） | 结构化输入 → 确定性判定与图表组装 |
| `triz_contradiction_analysis` | 交底书矛盾识别 + 矩阵落格 | 模型识别 → 工具落格/缺口判定 |

### workflow/matter（5）— P6

| 工具 | 用途 | 备注 |
|---|---|---|
| `patent_workflow_run` | manifest 执行（8 内置 + 4 domain graph） | LLM atom 改 stage brief 回灌（见反转清单） |
| `patent_workflow` | recap 收口（按 stage 汇总/标 degraded/持久化） | 无 LLM |
| `flexible_plan` | 案级阶段计划 HITL | 同 workflow_run |
| `patent_plan_task` | plantask 状态机（无状态 transition/sync/replan） | 无 LLM；映射见 matter-state.md |
| `workbench_link_patent_case` | 案件桥接工作台任务树 | 工作台 loopback HTTP；未接线时明确报错 |

### teams（12）— P6 按裁决 T1

`patent_teams_create/add_member/remove_member/create_task/reassign_task/claim_task/update_task/send_message/wait/status/archive/delete`。默认不搬；若 P6 补薄层则以 ZCode subagent 为执行底座重名注册（决策点在 overlap-decisions.md T1）。

### 文书/渲染/附图/filing（13）— P5

| 工具 | 来源包 | 用途 | 外部依赖 |
|---|---|---|---|
| `render_patent_document` | patent-document | 13 模板渲染（默认 HTML+PDF） | 模板随包；PDF 走系统 Chrome/pdf-plugin 通道 |
| `verify_deliverable` | patent-document | 交付核对（逐字节一致/sha256/时序/requirements 逐条） | 文件系统 |
| `build_patent_filing` | patent-filing | 申请文件 DOCX 成文（五节） | **Python + python-docx** |
| `verify_patent_filing` | patent-filing | DOCX 体例与内容断言 | Python |
| `generate_patent_figure` | patent-tools | 专利附图生成（SVG/PNG/PDF） | WASM 渲染器零依赖；Graphviz/Inkscape/FreeCAD 可选 |
| `generate_structure_figure` | patent-tools | 3D 模型投影结构线稿 | **FreeCAD freecadcmd**（默认关） |
| `add_patent_figure_references` | patent-tools | SVG 追加参考标号 | 无 |
| `verify_patent_figure` | patent-tools | 附图矢量量测复核 | 无 |
| `analyze_patent_figure` | patent-tools | 附图多模态分析 | LLM 反转（见清单）；索引写入保留 |
| `recognize_chemical_structure` | patent-tools | 化学结构识别 | 当前构建不可用，原样保留退化行为 |

### 文献（3）— P4

| 工具 | 来源包 | 用途 | 外部依赖 |
|---|---|---|---|
| `paper_search` | tool-literature | 学术文献检索（4 库免 key） | 网络 |
| `paper_download` | tool-literature | 论文 PDF 下载（magic/体积校验） | 网络 |
| `paper_list_sources` | tool-literature | 文献库清单 | 无 |

### TRIZ/撰写模式（2）— P3

| 工具 | 来源包 | 用途 | 外部依赖 |
|---|---|---|---|
| `triz` | methodology | 39 参数/40 原理/矛盾矩阵查表 | 随包 TRIZ 数据 |
| `query_writing_patterns` | writing-patterns | 撰写模式检索 + `<writing_skills>` 编译 | 随包语料 |

## 门禁结构（patent-rule 迁入后的落法）

DSH 三类门禁在 ZCode 的等价实现（无 runtime 工具钩子）：

1. **输出门禁**（DSH: post-execute waterfall；覆盖工具 = `gateToolNames`：render/draft_claims/draft_specification/validate_specification[+generate_patent_figure]）
   → ZCode：`patent-server` 在**工具返回前**对覆盖工具的输出文本跑 `keyword_blocklist` 规则族，命中按 warn 记 server 日志；规则引擎本体在 `patent-rule` domain。
2. **交付前置门禁**（DSH: `deliveryGate`，pre-execute）
   → ZCode：server 维护**会话×案卷台账**（key = caseId/case_dir，缺省会话级）：`render_patent_document`/`build_patent_filing` 调用前查 `rule_check`/`law_verify`/`matter_log_append` 成功记录 + evidence 字段校验（evaluated≥1 / findings≥1 / ok+manifestId 匹配）。拒绝时返回模型可读理由（点名缺哪一步）。台账是会话内投影，跨会话不持久（案件事实仍落 `_matter-log.md`）。
   - manifestId ↔ 模板映射照抄 preset：patentability-opinion→[patentability/novelty/inventiveness]_v1；search-report→[patentability/novelty]；oa-response→patent_oa_response_v1；invalidation-*→patent_invalidation_v1；re-examination-request→patent_reexamination_v1；infringement-opinion/litigation-pleading→patent_infringement_v1；claims-spec→patent_disclosure_v1。
3. **制品结构门禁**（DSH: `structuralGate`）
   → ZCode：server 在 `render_patent_document`（template=oa-response）调用前对 `draft` 入参跑规则 `PR-OA-007`（block 级）；规则 id 不在规则集 → 告警并忽略（fail-safe）。

## workflow manifest（8 个内置，P6 迁入）

`patent_novelty_v1 / patent_disclosure_v1 / patent_inventiveness_v1 / patent_patentability_v1 / patent_oa_response_v1 / patent_invalidation_v1 / patent_reexamination_v1 / patent_infringement_v1`（数据源 `patent-workflow/src/workflow/manifests.ts`，`SHIPPED_GUIDELINE_REVISION = 2023 年修订版（2024-01-20 施行）`）；外加 `patent_workflow_run` 的 4 个 domain graph：`novelty / inventiveness / enablement / citation-check`。

## 渲染模板（13 个，P5）

`patentability-opinion / search-report / search-report-form / oa-response / claims-spec / invalidation-opinion / invalidation-analysis / invalidation-defense / rectification-response / re-examination-request / infringement-opinion / litigation-pleading / right-evaluation-report`（数据源 `patent-document` 的 `TEMPLATE_IDS`）。`draft` 必填；`format` = html/pdf/both。

## 配置项（plugin.json / server 启动参数，预设默认值照抄 DSH preset）

- `cniprEnabled: true`；`nuoRequestChannel: native`（macOS 上浏览器路径会致零命中，按 DSH 实测固定）
- `imageModel: { provider: deepseek-official, model: deepseek-flash }`（analyze_patent_figure 路由；ZCode 侧改为 server 可选配置，未配置则该工具报 setup_required）
- `structureFigureEnabled: true`；`figureRequireCuttingMarks: true`；`figureFontMm: 4.25`；`figureMinFontMm: 4.23`（本所体例：图内文字 ≥ 小四）
- `writing-patterns.sectionCategories`: claim_drafting/spec_drafting/oa_inventiveness/oa_novelty/oa_clarity
- `patent-fees`: failOnUnverified 默认开（未核验项拒给合计）
- `patent-law`: onUnverified 默认 warn；cnlaw 声明段默认（cnlawEnabled=true，URL 指向 127.0.0.1:8100）——ZCode 侧默认改为**未启用**（本仓库无 cnlaw 底座），技能按声明段规则走回退通道
