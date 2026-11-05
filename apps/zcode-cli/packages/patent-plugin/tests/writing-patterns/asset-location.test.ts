import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PATTERN_FILE_SUFFIXES, patternDir } from '../../src/writing-patterns/asset-location.js'

// 源：DSH writing-patterns/tests/asset-location.spec.ts（纯库测试，import 改写）。

describe('pattern asset location', () => {
  it('resolves the packaged corpus beside this module', () => {
    // fileURLToPath keeps the trailing separator of the directory URL.
    expect(patternDir()).toMatch(/assets[/\\]patterns[/\\]?$/)
    expect(PATTERN_FILE_SUFFIXES).toEqual(['.yaml', '.yml'])
  })

  it('falls back to the packaged corpus for a blank override', () => {
    expect(patternDir('   ')).toBe(patternDir())
  })

  it('resolves an explicit override against the working directory', () => {
    expect(patternDir('./custom-patterns')).toBe(resolve('./custom-patterns'))
  })
})
