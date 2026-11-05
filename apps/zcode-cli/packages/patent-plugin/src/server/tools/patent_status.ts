/**
 * patent_status：v1 唯一工具。确定性、无副作用、入参为空对象。
 * 返回插件域标识、server 版本与当前能力清单（占位，后续阶段逐项点亮）。
 */
import { z } from "zod";

import {
  PATENT_DOMAIN_ID,
  PATENT_SERVER_VERSION,
  PATENT_TOOL_ERROR_CODES,
  type PatentToolDefinition,
} from "../contract.js";

export const PATENT_STATUS_TOOL_NAME = "patent_status";

export const PATENT_STATUS_DESCRIPTION =
  "查询专利域插件的运行状态与能力清单。返回 domain、server 版本和当前可用能力列表" +
  "（v1 仅有 status 占位能力）。无入参、无副作用、结果确定。";

/** v1 能力占位：点亮新能力时在此追加，模型侧据此判断可用工具面。 */
export const PATENT_STATUS_CAPABILITIES = ["status"] as const;

export const patentStatusOutputSchema = z.object({
  domain: z.literal(PATENT_DOMAIN_ID),
  version: z.string().min(1),
  capabilities: z.array(z.string().min(1)).min(1),
});

export type PatentStatusOutput = z.infer<typeof patentStatusOutputSchema>;

export const patentStatusTool: PatentToolDefinition<Record<string, never>, PatentStatusOutput> = {
  name: PATENT_STATUS_TOOL_NAME,
  description: PATENT_STATUS_DESCRIPTION,
  inputSchema: z.object({}).strict(),
  handler: async (_input, _context) => {
    try {
      return {
        ok: true,
        data: {
          domain: PATENT_DOMAIN_ID,
          version: PATENT_SERVER_VERSION,
          capabilities: [...PATENT_STATUS_CAPABILITIES],
        },
      };
    } catch (error) {
      // 确定性工具理论上不会失败；仍按一等错误对象返回，不让异常穿透到进程顶层。
      return {
        ok: false,
        error: {
          code: PATENT_TOOL_ERROR_CODES.internal,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
};
