import { chmod, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const defaultPackageRoot = resolve(import.meta.dirname, "..");
const executableFileMode = 0o755;

// esbuild 以 format: "esm" 打包时，会把 CJS 依赖里的 require() 替换成 __require shim：
//   typeof require !== "undefined" ? require : (name) => { throw Error('Dynamic require of ...') }
// ESM 模块作用域里没有 require，shim 永远走抛错分支；一旦后续工具把 CJS 依赖拖进 bundle，
// 产物会在模块求值阶段就炸（plugin host 表现为 mcp.server.closed、注册 0 个工具）。
// 注入真实 createRequire 让 shim 落到可用 require 上（产物仍是 ESM）。
const nodeRequireBanner = `import { createRequire as __zcodeCreateRequire } from "node:module";
const require = __zcodeCreateRequire(import.meta.url);`;

const createBundleOptions = ({ entryPoint, outfile }) => ({
  banner: {
    js: nodeRequireBanner,
  },
  bundle: true,
  entryPoints: [entryPoint],
  format: "esm",
  legalComments: "none",
  outfile,
  platform: "node",
  target: "node24",
});

/**
 * 供 scripts 直跑与后续 smoke test 复用的构建入口，
 * 保证测试校验的产物与发布产物同一套 esbuild 选项。
 */
export const buildPatentPluginBundles = async ({
  packageRoot = defaultPackageRoot,
  serverOutfile = resolve(packageRoot, "dist", "server.mjs"),
} = {}) => {
  await mkdir(dirname(serverOutfile), { recursive: true });
  await build(
    createBundleOptions({
      entryPoint: resolve(packageRoot, "src", "server", "server.ts"),
      outfile: serverOutfile,
    }),
  );
  await chmod(serverOutfile, executableFileMode);
  return { serverOutfile };
};

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  await buildPatentPluginBundles();
}
