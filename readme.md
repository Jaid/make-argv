# make-argv

Convert option objects and Maps into command-line argv arrays.

## Installation

```bash
bun add make-argv
```

## Usage

```ts
import makeArgv from 'make-argv'

makeArgv({
  outputFile: 'result.txt',
  verbose: true,
  retries: 3,
})
// ['--output-file', 'result.txt', '--verbose', '--retries', '3']
```

Single-character keys use a single-dash prefix by default:

```ts
makeArgv({a: 1, b: 2})
// ['-a', '1', '-b', '2']

makeArgv({a: 1, b: 2}, {prefix: '--'})
// ['--a', '1', '--b', '2']
```

The input may also be a `Map`, which is useful when preserving insertion order or constructing options incrementally.

## Options

- `prefix`: Prefix keys with `-`/`--` automatically, a fixed string, a custom function, or no prefix.
- `keyStyle`: Convert keys to `kebab` (default), `snake`, `camel`, or `pascal`, use a custom converter, or disable conversion.
- `arrayHandler`: Repeat keys (default), spread values after one key, join with commas/spaces/NUL, or use a custom joiner.
- `booleanHandler`: Emit positive flags (default), string values such as `true/false`, `1/0`, `on/off`, or `yes/no`, or customize boolean handling.
- `undefinedHandler`: Skip undefined values (default), emit a flag, or emit the literal string `undefined`.
- `connector`: Join scalar keys and values into one argument, for example `{connector: '='}` produces `--key=value`.
- `sort`: Sort keys alphabetically, with an `Intl.Collator`, or with a custom comparator.
- `flagsPosition`: Move valueless flags to the beginning or end of the argv array.

## Examples

See [the test suite](./test/main.test.ts) for executable examples covering each option family.
