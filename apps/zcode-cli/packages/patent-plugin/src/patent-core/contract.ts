/**
 * patent-core 对外契约：调用方要想正确调用就必须知道的一切都写在这里；其余对外不可见。
 * 每个方法注释写清：前置/后置条件、幂等性、发出哪些事件、是否等待持久化。
 *
 * 本模块是纯领域库（无服务方法、无 IO、无对世界的 await），其「契约」即跨模块
 * 使用所需的领域词汇类型：模型端口（LLM 消费的唯一注入点，ZCode 侧工具不内部
 * 调 LLM，语义反转见 docs/patent-domain/tools.md）、阶段能力提供者
 * StageProvider（atoms/graph 工作流执行时的能力注入缝）、workflow manifest 类型
 * （执行器由 patent-workflow 模块提供）。完整纯 API 见 index.ts。
 */

import type { GenerateOptions } from './harness-bridge.js'
import type { PatentModelPort, StageProvider } from './types.js'

export type {
  PatentModelEvent,
  PatentModelMessage,
  PatentModelPort,
  PatentModelRequest,
  PatentModelUsage,
  StageProvider,
  StageSearchHit,
} from './types.js'

export type { CreateLlmModelPortOptions } from './model-port.js'

export type {
  StageExecutor,
  WorkflowContext,
  WorkflowInterrupt,
  WorkflowManifest,
  WorkflowRunOptions,
  WorkflowRunResult,
  WorkflowRunStore,
  WorkflowStage,
  WorkflowStageResult,
  WorkflowStrategy,
} from './workflow/types.js'

/**
 * patent-core 的跨模块契约视图：消费方经模型端口与阶段能力注入点使用本模块。
 * 纯库无服务方法；该接口汇总契约词汇，便于 contract.example.ts 示范一次完整调用。
 * 前置条件：model 为已绑定路由（或 fail-loud 桩）的端口；stage 由执行宿主注入。
 * 幂等性：本契约类型无运行时行为；发出事件与持久化等待语义由注入的端口实现决定。
 */
export interface PatentCoreContract {
  /**
   * 专利域模型端口：所有 LLM 消费的唯一注入点。ZCode 侧由技能编排产出、
   * 确定性工具校验（语义反转）；未配置时 server 提供 fail-loud 桩
   * （code === 'setup_required'），工具内调用见错即抛、不得降级吞掉。
   */
  readonly model: PatentModelPort
  /**
   * 阶段能力提供者：workflow atoms 执行时的能力注入缝。callLLM 字符串接缝
   * 优先于 llm 端口（测试注入）；search 供检索类原子使用。
   */
  readonly stage: StageProvider
}

/**
 * bindSession 的会话身份参数类型（再导出，避免调用方直接依赖 harness-bridge）。
 */
export type PatentCoreSessionId = NonNullable<GenerateOptions['sessionId']>
