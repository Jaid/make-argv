import {expect, test} from 'bun:test'

const {default: makeArgv} = await import('#src/main.ts')

test('should run', () => {
  const result = makeArgv()
  expect(result).toBe('make-argv') // TODO Test actual functionality
})
