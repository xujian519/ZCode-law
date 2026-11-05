/**
 * 进程生命周期：参照 node-repl-host 的 process-lifecycle 模式精简版。
 * 差异：patent server v1 没有 Worker / CUA bridge，只保留
 * 「异步错误降级到 stderr」+「stdio 关闭/信号触发优雅退出」+「直跑检测」三件事。
 */
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const processGuardInstalled = new WeakSet<object>();
const OUTPUT_CLOSED_ERROR_CODES = new Set([
  "EPIPE",
  "EIO",
  "ENXIO",
  "EBADF",
  "ERR_STREAM_DESTROYED",
]);

function isOutputClosedError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === "string" && OUTPUT_CLOSED_ERROR_CODES.has(code);
}

/**
 * fire-and-forget 异步错误按 Node 默认策略会击穿整个 server 进程；
 * 这里降级为 stderr 日志，进程保活，协议 stdout 不被诊断输出污染。
 * 输出管道已关闭（EPIPE 等）说明 MCP client 不可达，必须直接进入 shutdown，
 * 不能继续写诊断，否则会形成 EPIPE → uncaughtException → stderr 写入的循环。
 */
export function installPatentProcessGuards(input: {
  onOutputClosed: (error: Error) => void;
  process: Pick<NodeJS.Process, "on">;
  writeStderr: (text: string) => void;
}): void {
  if (processGuardInstalled.has(input.process)) return;
  processGuardInstalled.add(input.process);

  let outputClosed = false;
  const describe = (reason: unknown): string =>
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  const report = (kind: "uncaughtException" | "unhandledRejection", reason: unknown): void => {
    if (outputClosed) return;
    if (isOutputClosedError(reason)) {
      outputClosed = true;
      input.onOutputClosed(reason);
      return;
    }
    try {
      input.writeStderr(`patent MCP ${kind} (process kept alive): ${describe(reason)}\n`);
    } catch (error) {
      if (!isOutputClosedError(error)) throw error;
      outputClosed = true;
      input.onOutputClosed(error);
    }
  };
  input.process.on("unhandledRejection", (reason) => {
    report("unhandledRejection", reason);
  });
  input.process.on("uncaughtException", (error) => {
    report("uncaughtException", error);
  });
}

/** MCP SDK 的 stdio transport 不监听 stdin end/close：父进程异常退出时本进程会沦为孤儿。 */
export function installPatentShutdownTriggers(input: {
  process: Pick<NodeJS.Process, "once">;
  shutdown: () => void;
  stdin: Pick<NodeJS.ReadStream, "once">;
}): void {
  let shutdownStarted = false;
  const shutdownOnce = () => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    input.shutdown();
  };
  input.stdin.once("end", shutdownOnce);
  input.stdin.once("close", shutdownOnce);
  input.process.once("SIGINT", shutdownOnce);
  input.process.once("SIGTERM", shutdownOnce);
}

/**
 * 判断本文件是不是被 `node dist/server.mjs` 直跑（而非被 import）。
 * macOS 的 /tmp、/var 会解析到 /private/...，直接比较 file URL 会让
 * stdio 子进程误判成「被 import」而静默不启动；异步 realpath 兼容 symlink 安装目录。
 */
export async function isDirectMcpEntrypoint(
  importMetaUrl: string,
  argvPath: string | undefined,
): Promise<boolean> {
  if (!argvPath) return false;
  try {
    const [modulePath, executablePath] = await Promise.all([
      realpath(fileURLToPath(importMetaUrl)),
      realpath(argvPath),
    ]);
    return modulePath === executablePath;
  } catch {
    return false;
  }
}
