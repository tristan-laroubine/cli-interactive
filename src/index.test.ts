import { describe, it, expect } from 'vitest'
import { hello } from './index.js'

describe('hello', () => {
  it('returns a greeting', () => {
    expect(hello('world')).toBe('Hello, world!')
  })
})
