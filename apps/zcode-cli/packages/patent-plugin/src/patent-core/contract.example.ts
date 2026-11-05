/**
 * patent-core 标准调用示例：agent 靠模仿写代码，这里放的就是该模仿的那份。
 */
import { collectPortText } from "./index.js";
import type { PatentCoreContract } from "./contract.js";

/**
 * 最常见的一次完整调用：消费方（技能编排层）注入模型端口，domain 内经
 * collectPortText 发起一次用户消息调用并收集可见文本。
 * 确定性工具不内部调 LLM（语义反转，见 docs/patent-domain/tools.md）；
 * 端口未配置时 fail-loud 桩以 code === 'setup_required' 抛错。
 */
export async function examplePatentCore(contract: PatentCoreContract): Promise<string> {
  return collectPortText(contract.model, "示例问题");
}
