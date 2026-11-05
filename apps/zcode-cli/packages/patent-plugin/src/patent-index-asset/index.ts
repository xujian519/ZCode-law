/**
 * patent-index-asset 公共入口（专利域移植，源：@deepseek-ai/dsh-patent-index-asset）。
 *
 * 随包事实索引（法条/费用）共用的资产格式：字段读取器一律「拒绝畸形字段、不做强转」，
 * 调用方注入自己的 AssetFail 工厂以保留各自的错误类型。
 *
 * 未迁部分：无。源包本身就是纯库（无 Cordis 插件壳），本次仅把相对 import 改写为
 * NodeNext ESM 的 `.js` 后缀。
 */
export { IndexAssetError, type AssetFail } from './errors.js'
export {
  parseYamlMapping,
  readCount,
  readEnum,
  readMapping,
  readOptionalBoolean,
  readOptionalCount,
  readOptionalDate,
  readOptionalString,
  readString,
} from './fields.js'
export { readRecordedSource, type RecordedSource } from './source.js'
