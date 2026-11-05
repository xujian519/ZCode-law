/**
 * patent-index-asset 标准调用示例：agent 靠模仿写代码，这里放的就是该模仿的那份。
 */
import { IndexAssetError } from "./index.js";
import type { PatentIndexAssetContract } from "./contract.js";

/** 调用方自己的可 catch 错误类型：绑定来源文件，保留本索引包的错误名。 */
class FeesIndexError extends IndexAssetError {
  constructor(message: string) {
    super(message, "fees-index.yaml");
    this.name = "FeesIndexError";
  }
}

export function examplePatentIndexAsset(contract: PatentIndexAssetContract): void {
  const fail = (message: string) => new FeesIndexError(message);
  const root = contract.parseYamlMapping("document: 收费标准\nitems: []\n", "费用索引", fail);
  const document = contract.readString(root, "document", fail);
  const verifiedOn = contract.readOptionalDate(root, "verifiedOn", fail);
  const entry = contract.readMapping(root["items"], "items 的每一项", fail);
  const source = contract.readRecordedSource(entry, fail);
  void document;
  void verifiedOn;
  void source;
}
