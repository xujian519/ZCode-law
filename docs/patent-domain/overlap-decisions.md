# 专利域能力重叠裁决（移植 spec）

- 裁决原则：**全量搬迁前提下，与 ZCode 已有能力重叠时选最优**；被裁「不搬」的仍是全量搬迁的组成部分——其能力以 ZCode 侧等价物承接，缺口在本文档显式记录。
- 本文档是正式裁决；实施中如推翻某条，须先更新本文档并注明依据。

## T1. patent-teams 多智能体团队 vs ZCode subagent runtime —— 调度器不搬

**事实**：`patent-teams`（11,471 行）= captain-led 持久团队 + 成员邮箱 + 依赖任务图 + 共享调度器 + 原子持久化。成员是「可续跑的 LLM 子代理」（经 `ctx.subagents` spawn/wake/interrupt）。ZCode CLI 已有成熟 subagent runtime（spawn/fork、SendMessage、会话续跑）。预设技能 `patent-team-composition` 要求团队场景：立案/撰写/答复/无效/侵权等组队模板，captain 调度、成员派工、收口审批。

**裁决**：调度器/邮箱/任务持久化/成员续跑**不搬**；团队能力以 ZCode subagent 等价承接：

- 团队组成模板（角色清单、组队方案、审批确认点）→ 迁入 `agents/patent-team-roles.md` + 技能 `patent-team-composition` 改写为「基于 ZCode subagent 的组队指南」。
- 派工/汇报/互评 → 技能编排 subagent 调用；「对立审查员互评」等已有先例（persona 本身允许 subagent_fork 专家互评）。
- `patent_teams_*` 12 个工具**不注册**；技能正文引用改写为 subagent 等价路径。
- 12 个 teams 工具的纯领域部分（任务依赖图 ready 判定、attempt 陈旧语义）价值已被 ZCode runtime 覆盖，不重复建设。

**缺口记录**（相对 DSH 的已知能力损失，如实声明）：跨会话持久邮箱、captain 以 `patent_teams_wait` 事件等待的精确语义、成员 LLM 路由逐人快照。若后续用户明确要求「持久团队」，以 ZCode subagent 为基座补薄层（新立项，不属本期）。

## T2. knowledge.db 数据资产 vs 仓库体积 —— 二进制不进 git

**事实**：`patent-knowledge` 依赖 knowledge.db（SQLite，含判例 FTS/法规/KG/wiki）；DSH 提供 `patent-knowledge-install` bin 从源库（默认 `~/.sati/knowledge/knowledge.db`）裁剪出 lite 版。

**裁决**：代码迁入 `patent-knowledge` 模块 + install bin 随迁（输出到用户数据目录）；**knowledge.db 任何形态不进本仓库**。工具在库缺失时返回 `setup_required` 类明确错误（点名缺 knowledge.db 与安装命令），不静默降级、不返回空结果冒充「无命中」。

## T3. cnlaw REST —— 默认可选、默认关闭

**事实**：DSH 默认 `cnlawEnabled: true` 指向 `http://127.0.0.1:8100`（本地法律底座）；persona 依赖其声明段决定是否尝试本机端点。

**裁决**：ZCode 插件默认 `cnlawEnabled: false`（本仓库无该底座）；法条/指南核验优先走随包转录索引（`law_verify`/`law_search` 的确定性部分）与回退通道（检索/网络）。声明段语义保留：未启用时技能不得尝试本机 cnlaw 端点。`inventive-step-analysis` 技能中的 `cnlaw_inventive_step` 四步证据包引用改写为「有底座时用底座、无底座时按技能回退例程搜集证据」。

## T4. patent-document 的 PDF 通道 vs pdf-plugin/系统 Chrome

**事实**：DSH 用 `ctx.subprocess` 起 headless Chrome 打印 PDF（`Config.chromePath` 可覆盖）。ZCode 已有 pdf-plugin（MCP stdio server + 侧栏查看）与 office-runtime。

**裁决**：13 个模板与 HTML 渲染**全量迁入**；PDF 打印优先复用系统 Chrome/Chromium（server 探测，`chromePath` 可配）；与 pdf-plugin 的更深集成（侧栏查看）不在本期，留集成点（`ui.surfaces` 声明暂不注册）。

## T5. patent-data 浏览器通道 vs ZCode 浏览器能力

**事实**：CNIPR 反爬通道依赖 ego-browser CLI（ego lite 登录态）；nuo-patent 的 fetchHtml 在 PATH 有 ego-browser 时也会经浏览器发请求（preset 已固定 `nuoRequestChannel: native` 规避零命中问题）。ZCode 用户级已有 `ego-browser`/`cnipr-search-download`/`google-patents-search` 等 skill。

**裁决**：ego-browser CLI 适配器**原样迁入**（`patent-data` 模块），登录态语义不变；未安装 ego-browser 时 CNIPR/PDF 通道报 `login_required`/`setup_required` 并点名，不静默降级（与 DSH 一致）。与用户级通道 skill 的关系：并存——技能级通道由用户选择叠加，工具级通道是域内置默认。

## T6. workflow HITL vs ZCode plan/approval —— 映射而非搬运

**事实**：DSH plantask awaiting_approval 经 `ctx.approval.request` waterfall；deliveryGate 的执行点强制。

**裁决**：见 [matter-state.md](matter-state.md) HITL 映射：工具返回待批准态 + 技能编排 ZCode 询问/plan 审批；fail-closed 语义保留。不搬 `dsh-user-approval` 包。

## T7. tool-literature vs 用户级 academic-search skill —— 都保留

**事实**：用户级 `academic-search` skill 是检索流程指南；`tool-literature` 是代码连接器（4 个免 key API）。

**裁决**：`tool-literature` 代码迁入（`paper_search`/`paper_download`/`paper_list_sources` 入 P4）；用户级 skill 保留不动。二者并存：skill 管方法，工具管执行。

## T8. 通用文书工具（doc-template / document-deliver）—— 不搬

DSH 的 `list_doc_templates`/`render_doc_template`/`document_deliver` 属通用文书链路、不在 patent preset 挂载清单。ZCode 侧有 pdf-plugin 等价的产出通路。**不搬**；若后续需要，另行立项。

## T9. DSH 通用行（shell/fs/jobs/schedule/web/goal/plan-mode/compaction/delegation/time-context/ask-user/todo）

**裁决**：一律不搬。ZCode runtime 自带对应能力；人设中引用这些能力处（如 ask_user_question、todo、goal）在 agents 改写时映射为 ZCode 等价物。`tool-schedule` 的期限提醒排程语义在 ZCode 无直接等价物——**缺口记录**：P6 后如需答复/年费提醒排程，基于 ZCode 既有机制另行设计。

## T10. self-evolve-benchmark / openviking —— 不搬

部署特性，非专利域能力。

## 裁决汇总表

| # | 对象 | 裁决 | 阶段 |
|---|---|---|---|
| T1 | patent-teams 调度器 + 12 工具 | 不搬；subagent 等价承接 | P6 |
| T2 | knowledge.db 二进制 | 不进 git；install bin 随迁 | P3 |
| T3 | cnlaw REST | 默认关闭、声明段保留 | P3 |
| T4 | headless Chrome PDF | 模板迁入；PDF 走系统 Chrome | P5 |
| T5 | ego-browser 通道 | 原样迁入 | P4 |
| T6 | approval runtime | 映射 plan/approval，不搬包 | P6 |
| T7 | literature vs 用户 skill | 并存 | P4 |
| T8 | 通用文书工具 | 不搬 | — |
| T9 | DSH 通用行 | 不搬（schedule 排程缺口记录） | P1 改写 |
| T10 | self-evolve/openviking | 不搬 | — |
