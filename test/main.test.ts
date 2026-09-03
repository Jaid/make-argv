import {describe, expect, test} from 'bun:test'

import makeArgv, {makeArgv as namedMakeArgv} from '../src/main.ts'

describe('makeArgv', () => {
  test('exports the same function as default and named export', () => {
    expect(makeArgv).toBe(namedMakeArgv)
  })
  test('converts scalar object values to argv entries', () => {
    expect(makeArgv({
      outputFile: 'result.txt',
      retries: 3,
    })).toEqual([
      '--output-file',
      'result.txt',
      '--retries',
      '3',
    ])
  })
  test('uses a single dash for single-character keys by default', () => {
    expect(makeArgv({
      a: 1,
      b: 2,
    })).toEqual(['-a', '1', '-b', '2'])
  })
  test('supports a fixed prefix', () => {
    expect(makeArgv({
      a: 1,
      b: 2,
    }, {prefix: '--'})).toEqual(['--a', '1', '--b', '2'])
  })
  test('supports no prefix and no key conversion', () => {
    expect(makeArgv({'Hello World': 1}, {
      keyStyle: false,
      prefix: false,
    })).toEqual(['Hello World', '1'])
  })
  test('supports built-in and custom key converters', () => {
    expect(makeArgv({'hello world': 1}, {keyStyle: 'snake'})).toEqual(['--hello_world', '1'])
    expect(makeArgv({'hello world': 1}, {keyStyle: 'camel'})).toEqual(['--helloWorld', '1'])
    expect(makeArgv({'hello world': 1}, {keyStyle: 'pascal'})).toEqual(['--HelloWorld', '1'])
    expect(makeArgv({hello: 1}, {keyStyle: key => key.toUpperCase()})).toEqual(['--HELLO', '1'])
  })
  test('supports Map inputs', () => {
    expect(makeArgv(new Map<string, number | string>([['firstValue', 1], ['secondValue', 'two']]))).toEqual([
      '--first-value',
      '1',
      '--second-value',
      'two',
    ])
  })
  test('handles boolean flags by default', () => {
    expect(makeArgv({
      verbose: true,
      quiet: false,
      output: 'file',
    })).toEqual([
      '--verbose',
      '--output',
      'file',
    ])
  })
  test('supports built-in boolean value pairs', () => {
    expect(makeArgv({
      enabled: true,
      disabled: false,
    }, {booleanHandler: 'true'})).toEqual([
      '--enabled',
      'true',
      '--disabled',
      'false',
    ])
    expect(makeArgv({
      enabled: true,
      disabled: false,
    }, {booleanHandler: '1'})).toEqual([
      '--enabled',
      '1',
      '--disabled',
      '0',
    ])
    expect(makeArgv({
      enabled: true,
      disabled: false,
    }, {booleanHandler: 'on'})).toEqual([
      '--enabled',
      'on',
      '--disabled',
      'off',
    ])
    expect(makeArgv({
      enabled: true,
      disabled: false,
    }, {booleanHandler: 'yes'})).toEqual([
      '--enabled',
      'yes',
      '--disabled',
      'no',
    ])
  })
  test('supports boolean prefix objects', () => {
    expect(makeArgv({
      cache: true,
      color: false,
    }, {booleanHandler: {prefix: 'no-'}})).toEqual([
      '--cache',
      '--no-color',
    ])
  })
  test('skips undefined by default and supports alternate undefined handlers', () => {
    expect(makeArgv({output: undefined})).toEqual([])
    expect(makeArgv({output: undefined}, {undefinedHandler: 'flag'})).toEqual(['--output'])
    expect(makeArgv({output: undefined}, {undefinedHandler: 'literal'})).toEqual(['--output', 'undefined'])
  })
  test('repeats arrays and Sets by default', () => {
    expect(makeArgv({tag: ['one', 'two']})).toEqual(['--tag', 'one', '--tag', 'two'])
    expect(makeArgv({tag: new Set(['one', 'two'])})).toEqual(['--tag', 'one', '--tag', 'two'])
  })
  test('supports spread and joined arrays', () => {
    expect(makeArgv({tag: ['one', 'two']}, {arrayHandler: 'spread'})).toEqual(['--tag', 'one', 'two'])
    expect(makeArgv({tag: ['one', 'two']}, {arrayHandler: 'comma'})).toEqual(['--tag', 'one,two'])
    expect(makeArgv({tag: ['one', 'two']}, {arrayHandler: 'space'})).toEqual(['--tag', 'one two'])
  })
  test('supports scalar connectors', () => {
    expect(makeArgv({
      outputFile: 'result.txt',
      retries: 3,
    }, {connector: '='})).toEqual([
      '--output-file=result.txt',
      '--retries=3',
    ])
  })
  test('supports connector functions', () => {
    const connectors = new Map([['output', '=']])
    expect(makeArgv({
      output: 'file',
      retries: 3,
    }, {
      connector: key => connectors.get(key),
    })).toEqual(['--output=file', '--retries', '3'])
  })
  test('sorts keys', () => {
    expect(makeArgv({
      zebra: 1,
      alpha: 2,
    }, {sort: true})).toEqual([
      '--alpha',
      '2',
      '--zebra',
      '1',
    ])
  })
  test('can move flags to the beginning or end', () => {
    const input = {
      first: 1,
      verbose: true,
      second: 2,
      quiet: true,
    }
    expect(makeArgv(input, {flagsPosition: 'first'})).toEqual([
      '--verbose',
      '--quiet',
      '--first',
      '1',
      '--second',
      '2',
    ])
    expect(makeArgv(input, {flagsPosition: 'last'})).toEqual([
      '--first',
      '1',
      '--second',
      '2',
      '--verbose',
      '--quiet',
    ])
  })
})
