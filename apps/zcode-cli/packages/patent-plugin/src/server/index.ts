/**
 * patent-server 公开入口。模块内部分文件（server.ts / process-lifecycle.ts / tools/）
 * 不属于 publicEntrypoints，跨模块请只从本文件或 contract.ts 取。
 */
export {
  PATENT_DOMAIN_ID,
  PATENT_SERVER_NAME,
  PATENT_SERVER_VERSION,
  PATENT_TOOL_ERROR_CODES,
  REQUEST_CONTEXT_META_KEY,
  requestContextSchema,
  type PatentRequestContext,
  type PatentToolDefinition,
  type PatentToolError,
  type PatentToolErrorCode,
  type PatentToolHandlerContext,
  type PatentToolResult,
} from "./contract.js";
export { patentServerModule } from "./module.js";
export { getPatentTool, patentToolRegistry, toMcpPatentTools } from "./tool-registry.js";
export {
  createPatentMcpServer,
  main,
  PATENT_MCP_PROCESS_TITLE,
  PATENT_SERVER_INSTRUCTIONS,
  setPatentMcpProcessTitle,
  type PatentMcpRuntime,
} from "./server.js";
