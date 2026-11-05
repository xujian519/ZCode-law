# 专利域案件状态设计（移植 spec）

- 唯一事实源：案件目录 `_matter-log.md`（只追加事件日志）
- 投影：MCP server 会话台账、工作台任务树（只读投影，禁止回写）
- 本文档定义状态机、事件顺序、幂等边界与 HITL 映射；实现以此为准

## 案卷目录约定（照抄 DSH 技能 patent-workspace-layout / patent-matter）

```text
<workspace>/<案号>-<名称>/
├── 00-交底书/  01-检索/  02-对比文件/  03-分析/  04-撰写/  05-答复/
├── 99-知识库/
├── _case-registry.md   # 案件登记表（立案时建，人工可读）
└── _matter-log.md      # 只追加事件日志 = 状态唯一事实源
```

- `_matter-log.md` 每条事件：`matter_log_append` 写入，含 action（建案/检索/分析/撰写/门禁/修订/交付/归档）、artifacts（路径清单）、changes、supersedes（取代链）。
- 事件**只追加**：修正旧结论靠新事件声明 supersedes，不改写历史行。

## 状态所有者

| 状态 | 所有者 | 存储 |
|---|---|---|
| 案件事件历史 | `matter_log_append`（工具内原子追加） | `_matter-log.md` |
| plantask 计划状态 | `patent_plan_task`（无状态迁移器；状态由调用方持有） | 调用方上下文 + 可选案件文件 |
| workflow run 执行态 | `patent_workflow_run`（工具内执行器） | 案卷 `workflow-runs/` 目录（checkpoint 持久化） |
| 交付门禁台账 | `patent-server` 会话内 | server 进程内存（会话投影，非事实源） |
| 工作台任务树 | 工作台宿主 | loopback HTTP（投影） |

```text
模型/技能 ──命令──> 工具（唯一写入口）
                      ├─ matter_log_append → 原子追加 _matter-log.md
                      ├─ patent_workflow_run → checkpoint 落 workflow-runs/
                      └─ 交付工具 → 查 server 台账 → 通过后落盘交付物
工作台 ──只读投影──> _matter-log.md（禁止回写）
```

## plantask 状态机（照抄 DSH patent-workflow）

状态：`planning → awaiting_approval → executing →（replanning 回环）→ finished`。

- **迁移守卫**（纯函数，迁入 `patent-workflow` domain）：
  - 进入 `executing`：存在 open 且 blocking≠none 的 docket issue → 拒绝（`openBlockingIssues`）。
  - 进入 `replanning`：存在 open 且 blocking=terminal 的 issue → 拒绝（`openTerminalIssues`）。
  - `finished` 无出边（终态不可再 dispatch）。
  - `roundCapReached(rounds, maxRounds)`：maxRounds 默认 3；到达上限后 reject 不再驱动 replanning，计划直接 `finished` 且 `roundCapExhausted: true`。计数**按 caseId、每 server 进程一份**（DSH 即进程级，重启清零；保持该语义并在 spec 注明）。
- **HITL 映射**（DSH 经 `ctx.approval` waterfall；ZCode 无此 seam）：
  - `awaiting_approval` 不停在工具内等用户：工具返回「待批准」结果（含 plan 摘要与 reason），技能据此发起 ZCode 询问/plan 审批交互；用户批准后技能以 `action: transition / to: executing` 重新调用 `patent_plan_task` 推进。
  - **fail-closed**：无用户决策不得自动批准；技能侧按「用户未表态=未获批」处理。
- `runPlantask` 的单会话单案语义：同一 caseId 并发 run 拒绝（DSH 语义保持）。

## DocketIssue（案件问题簿）

- 结构：`id/summary/kind/disposition/status/blocking/round_opened[/anchor]`；kind 六种封闭词表（machine format / amendable substantive defect / evidence gap / scope-strategy choice / defect no amendment can cure / noise）。
- `blocking` 三档：`none / blocking / terminal`；默认值表来自 `assets/issue-dispositions.json`（随包迁入，`loadIssueDispositions()` 载入校验：六种 kind 各恰好一行、取值在词表内、criteria 非空）。
- `resolveDocketIssue(draft, round, dispositions)` 补默认 disposition/blocking、置 `status: open`、盖 `round_opened` 戳；显式值覆盖默认行。
- 已知限制随迁：「review issue list → docket items」的生产接线在 DSH 亦未接通；本域保持 schema+守卫+纯函数，不虚构生产者。

## workflow run 事件顺序（LLM 反转后的执行模型）

DSH：`runWorkflow` 内 LLM atom 同步执行。ZCode：执行器遇到 LLM atom → 产出 **stage brief**（该阶段的目标、输入摘要、期望产出结构）并持久化 checkpoint → 工具返回 `interrupted: 'awaiting_model'` 型结果 → 技能驱动模型完成该阶段 → 以 `resumeCheckpointId + 阶段产出` 重调 `patent_workflow_run` → 执行器从 checkpoint 继续，确定性 atom 照常原路执行。

```text
1. patent_workflow_run(manifestId, input, caseId)
2. 执行确定性前缀 atom；遇 LLM atom → 写 checkpoint(workflow-runs/) → 返回 stage brief
3. 技能编排模型产出阶段结果（structured）
4. patent_workflow_run(resumeCheckpointId, stageOutputs) → 校验产出结构 → 继续
5. approval-gate atom → 同 plantask HITL：返回待批准 + 以 approveStageIds 恢复
6. 完成 → run 结果含 evidenceLedger（来源清单）→ 技能必须 matter_log_append(action=收口)
```

幂等边界：

- `resumeCheckpointId` 唯一指向一次 run 的一个 checkpoint；同一 checkpoint 的重复 resume 以**先成功者为准**，后到请求返回当前 run 状态（不重复执行已完成的下游 atom）。
- 交付门禁的 `patent_workflow_run` 证据要求 `ok=true` 且 manifestId 精确匹配——任意 manifest 的成功记录不得冒充（台账校验逻辑在 server）。

## workbench 桥接

- `workbench_link_patent_case(caseNumber, ...)`:幂等建 L1–L5 阶段子任务（source=patent），状态投影自 `_matter-log.md`。
- ZCode 侧若工作台 loopback HTTP 不可用：工具返回 `unavailable` + 明确说明，技能降级为「仅维护案件目录」；**禁止**伪造桥接成功。
- 工作台禁止反向改写案件状态或案件文件（投影纪律）。

## 时间与时钟

- DSH preset 的 `time-context` 插件（给模型「今天」）不搬；ZCode 会话已有等价机制时复用，技能在涉期限计算前仍应显式确认当前日期（`patent_deadlines` 入参携带计算基准日）。
