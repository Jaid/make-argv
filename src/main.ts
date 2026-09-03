import type {Dict, SecondParameter} from 'more-types'
import type {OptisParameter, OptisProcessed} from 'optis'
import type {Arrayable} from 'type-fest'

import {camelCase, kebabCase, pascalCase, snakeCase} from 'es-toolkit'

type OptionsSetup = {
  defaults: typeof defaultOptions
  optional: {
    /**
     * String that is used to join key and value into a single argument. If a function is provided, it can optionally return `undefined` to selectively decide when to join and when to spread.
     */
    connector: ((key: string, value: Value) => string | undefined) | string
    /**
     * All value-less flags can be moved to the start or to the end.
     * This is useful to lower the chance of value-less flags accidentally swallowing positional arguments.
     * This does not change sorting except for the split into two groups.
     */
    flagsPosition: 'first' | 'last'
    /**
     * @summary
     * output key sorting
     * @description
     * If `true`, keys are sorted alphabetically.\
     * If `instanceof Intl.Collator` keys are sorted according to the collator rules.\
     * If `options.flagsPosition` is also set, grouping takes precedence and sorting is applied within each group.
     */
    sort: ((aKey: string, bKey: string, aValue: Value, bValue: Value) => number) | Intl.Collator | boolean
  }
}

type Options = {
  merged: OptisProcessed<OptionsSetup>
  parameter: NonNullable<OptisParameter<OptionsSetup>>
}
type SingleValue = boolean | number | string | undefined
type Value = Array<SingleValue> | Set<SingleValue> | SingleValue
type ProcessedValue = {key: string
  value: Arrayable<string>} | string | undefined
const defaultOptions = {
  /**
   * @summary
   * prefix that is prepended to each key
   * @description
   * If `false`, no prefix is set.\
   * If `true`, prefix is dynamically chosen between `'--'` and `'-'` depending on whether the key is a single character.
   */
  prefix: true as ((key: string) => string) | false | true | string,
  /**
   * @summary
   * converter rule for transforming an input key style to an output key style
   * @description
   * `'my option'` with `'camel'` → `'myOption'`\
   * `'my option'` with `'kebab'` → `'my-option'`\
   * `'my option'` with `'pascal'` → `'MyOption'`\
   * `'my option'` with `'snake'` → `'my_option'`
   */
  keyStyle: 'kebab' as SecondParameter<typeof convertKey>,
  /**
   * @summary
   * preferred strategy for handling array and Set values
   * @description
   * If `'repeat'`, arrays are spread into multiple key-value pairs. This means the output may contain duplicate keys. (`['--tags', 'foo', '--tags', 'bar']`)\
   * If `'spread'`, arrays are spread into multiple values, but they all share the same key. (`['--tags', 'foo', 'bar']`)
   */
  arrayHandler: 'repeat' as ((value: Array<SingleValue> | Set<SingleValue>) => string) | keyof typeof arrayHandlerMap | 'repeat' | 'spread',
  /**
   * @summary
   * preferred strategy for handling boolean values
   * @description
   * If `'flag'`, boolean values are keys-only without a value present in the output. (`['--verbose']`)\
   * If `'true'`, uses `'true'` and `'false'`. (`['--is-barking', 'false', '--is-good-boy', 'true']`)\
   * If `'1'`, uses `'1'` and `'0'`. (`['--is-barking', '0', '--is-good-boy', '1']`)\
   * If `'on'`, uses `'on'` and `'off'`. (`['--is-barking', 'off', '--is-good-boy', 'on']`)\
   * If `'yes'`, uses `'yes'` and `'no'`. (`['--is-barking', 'no', '--is-good-boy', 'yes']`)
   */
  booleanHandler: 'flag' as ((key: string, value: boolean) => string) | keyof typeof booleanCounterparts | {keyModifier: (key: string) => string} | {negativePrefix: string
    positivePrefix: string} | {negativeValue: string
      positiveValue: string} | {prefix: string} | 'flag',
  /**
   * @summary
   * preferred strategy for handling `undefined` values
   * @description
   * If `'flag'`, the key is included as a flag without a value. (`['--my-option']`)\
   * If `'literal'`, the string `'undefined'` is used as the value. (`['--my-option', 'undefined']`)\
   * If `'skip'`, the key-value pair is omitted entirely. (`[]`)
   */
  undefinedHandler: 'skip' as 'flag' | 'literal' | 'skip',
}
const keyConverters = {
  kebab: kebabCase,
  snake: snakeCase,
  camel: camelCase,
  pascal: pascalCase,
}
const convertKey = (key: string, style: ((key: string) => string) | keyof typeof keyConverters | false): string => {
  if (!style) {
    return key
  }
  if (typeof style === 'function') {
    return style(key)
  }
  return keyConverters[style](key)
}
const arrayHandlerMap = {
  comma: ',',
  space: ' ',
  x00: String.fromCodePoint(0),
}
type BooleanCounterpart = '1' | 'on' | 'true' | 'yes'
const booleanCounterparts: Record<BooleanCounterpart, string> = {
  true: 'false',
  1: '0',
  on: 'off',
  yes: 'no',
}

export const makeArgv = (values: Dict<Value> | Map<string, Value>, options?: Options['parameter']) => {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  }
  const getPrefix = (convertedKey: string): string => {
    if (!mergedOptions.prefix) {
      return ''
    }
    if (mergedOptions.prefix === true) {
      return convertedKey.length === 1 ? '-' : '--'
    }
    if (typeof mergedOptions.prefix === 'function') {
      return mergedOptions.prefix(convertedKey)
    }
    return mergedOptions.prefix
  }
  const process = (key: string, value: Value): Arrayable<ProcessedValue> => {
    // Convert key according to keyStyle
    const convertedKey = convertKey(key, mergedOptions.keyStyle)
    // Apply prefix
    const prefix = getPrefix(convertedKey)
    const outputKey = prefix + convertedKey
    // Handle undefined values
    if (value === undefined) {
      if (mergedOptions.undefinedHandler === 'skip') {
        return undefined
      }
      if (mergedOptions.undefinedHandler === 'flag') {
        return outputKey
      }
      // 'literal'
      return {
        key: outputKey,
        value: 'undefined',
      }
    }
    // Handle boolean values
    if (typeof value === 'boolean') {
      const handler = mergedOptions.booleanHandler
      if (handler === 'flag') {
        return value ? outputKey : undefined
      }
      if (typeof handler === 'function') {
        const result = handler(convertedKey, value)
        return {
          key: outputKey,
          value: result,
        }
      }
      if (typeof handler === 'object') {
        if ('keyModifier' in handler) {
          const modifiedKey = handler.keyModifier(convertedKey)
          const newPrefixedKey = `${getPrefix(modifiedKey)}${modifiedKey}`
          return newPrefixedKey
        }
        if ('positiveValue' in handler) {
          return {
            key: outputKey,
            value: value ? handler.positiveValue : handler.negativeValue,
          }
        }
        if ('positivePrefix' in handler) {
          const keyPrefix = value ? handler.positivePrefix : handler.negativePrefix
          const finalKey = `${keyPrefix}${convertedKey}`
          const newPrefixedKey = `${getPrefix(finalKey)}${finalKey}`
          return newPrefixedKey
        }
        if ('prefix' in handler) {
          const finalKey = value ? convertedKey : `${handler.prefix}${convertedKey}`
          const newPrefixedKey = `${getPrefix(finalKey)}${finalKey}`
          return newPrefixedKey
        }
      }
      // Handler is a key from booleanCounterparts
      if (typeof handler === 'string') {
        return {
          key: outputKey,
          value: value ? handler : booleanCounterparts[handler],
        }
      }
      return value ? outputKey : undefined
    }
    if (Array.isArray(value) || value instanceof Set) {
      // eslint-disable-next-line unicorn/prefer-spread
      const arrayValues = Array.isArray(value) ? value : Array.from(value)
      const filteredValues = arrayValues.filter(v => v !== undefined)
      if (typeof mergedOptions.arrayHandler === 'function') {
        const result = mergedOptions.arrayHandler(value)
        return {
          key: outputKey,
          value: result,
        }
      }
      if (mergedOptions.arrayHandler === 'repeat') {
        return filteredValues.map(item => ({
          key: outputKey,
          value: String(item),
        }))
      }
      if (mergedOptions.arrayHandler === 'spread') {
        return {
          key: outputKey,
          value: filteredValues.map(String),
        }
      }
      const separator = arrayHandlerMap[mergedOptions.arrayHandler]
      const joinedValue = filteredValues.map(String).join(separator)
      return {
        key: outputKey,
        value: joinedValue,
      }
    }
    const connector = typeof mergedOptions.connector === 'function' ? mergedOptions.connector(convertedKey, value) : mergedOptions.connector
    if (connector === undefined || connector === ' ') {
      return {
        key: outputKey,
        value: String(value),
      }
    }
    return `${outputKey}${connector}${value}`
  }
  const applySorting = (entries: Array<[string, Value]>): Array<[string, Value]> => {
    const sortOption = mergedOptions.sort
    if (!sortOption) {
      return entries
    }
    if (typeof sortOption === 'function') {
      return entries.toSorted((a, b) => sortOption(a[0], b[0], a[1], b[1]))
    }
    if (sortOption instanceof Intl.Collator) {
      return entries.toSorted((a, b) => sortOption.compare(a[0], b[0]))
    }
    return entries.toSorted((a, b) => a[0].localeCompare(b[0]))
  }
  const flattenResult = (result: Arrayable<ProcessedValue>): Array<string> => {
    if (result === undefined) {
      return []
    }
    if (typeof result === 'string') {
      return [result]
    }
    if (Array.isArray(result)) {
      // Array of ProcessedValue - recursively flatten each
      return result.flatMap(flattenResult)
    }
    // Single object with key and value(s)
    if (Array.isArray(result.value)) {
      // Spread: key followed by multiple values
      return [result.key, ...result.value]
    }
    // Single key-value pair
    return [result.key, result.value]
  }
  const flags: Array<string> = []
  const valuedArgs: Array<string> = []
  // Convert Map to entries or use Object.entries for Dict
  // eslint-disable-next-line unicorn/prefer-spread
  let entries = values instanceof Map ? Array.from(values.entries()) : Object.entries(values)
  entries = applySorting(entries)
  for (const [key, value] of entries) {
    const result = process(key, value)
    const flattened = flattenResult(result)
    if (flattened.length === 1) {
      flags.push(flattened[0])
    } else {
      valuedArgs.push(...flattened)
    }
  }
  if (mergedOptions.flagsPosition === 'first') {
    return [...flags, ...valuedArgs]
  }
  if (mergedOptions.flagsPosition === 'last') {
    return [...valuedArgs, ...flags]
  }
  const args: Array<string> = []
  let entriesAgain = values instanceof Map ? [...values.entries()] : Object.entries(values)
  entriesAgain = applySorting(entriesAgain)
  for (const [key, value] of entriesAgain) {
    const result = process(key, value)
    const flattened = flattenResult(result)
    args.push(...flattened)
  }
  return args
}

export default makeArgv
