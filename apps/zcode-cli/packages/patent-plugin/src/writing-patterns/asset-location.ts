/**
 * Locate the packaged pattern corpus.
 *
 * The seed corpus ships inside the package (`assets/patterns/`) and resolves
 * relative to this module, so both the source tree and the built `lib/` bundle
 * read the same directory. An explicit directory replaces the packaged one and
 * must contain the same YAML pattern files.
 * @module @deepseek-ai/dsh-writing-patterns/asset-location
 */

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 移植说明：源实现以模块文件为锚、用 `../assets/` 从包内 src/ 子目录指向包根资产；
// 本仓库 managed module 的文件直接在模块根（src/writing-patterns/）下，`../assets/`
// 会解析到 src/assets/。为保持「资产随模块共置、以模块文件为锚」的不变量
//（docs/patent-domain/architecture.md 资产落位决策），算术改为 `./assets/`。
const ASSETS_PATTERNS_URL = new URL('./assets/patterns/', import.meta.url)

/** Suffixes of a pattern asset file; every other entry of the directory is ignored. */
export const PATTERN_FILE_SUFFIXES = ['.yaml', '.yml'] as const

/**
 * Directory holding the pattern assets: the explicit override when given
 * (resolved against the process working directory), otherwise the packaged one.
 * @param patternDir - optional directory override.
 * @returns the absolute pattern directory path.
 */
export function patternDir(patternDir?: string): string {
  return patternDir !== undefined && patternDir.trim() !== ''
    ? resolve(patternDir)
    : fileURLToPath(ASSETS_PATTERNS_URL)
}
