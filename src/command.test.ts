import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import z from 'zod'
import { InteractiveCLI } from './command.js'
import { input, select, confirm, number } from '@inquirer/prompts'

const inputMock = input as Mock
const selectMock = select as Mock
const confirmMock = confirm as Mock
const numberMock = number as Mock

// ---------------------------------------------------------------------------
// Shared schema
// ---------------------------------------------------------------------------

const schema = z.object({
  name: z.string().describe('Your name'),
  env: z.enum(['development', 'production', 'test']).default('development').describe('Target environment'),
  verbose: z.boolean().optional().describe('Enable verbose output'),
})

// Mock @inquirer/prompts so tests never open an actual TTY
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  number: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
}))

describe('InteractiveCLI', () => {
  const originalArgv = process.argv

  beforeEach(() => {
    process.argv = ['node', 'cli']
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.argv = originalArgv
    vi.restoreAllMocks()
  })


  describe('resolveArgs() — argv', () => {
    it('returns parsed args from argv with --no-prompt', async () => {
      process.argv = ['node', 'cli', '--name', 'Alice', '--env', 'production', '--no-prompt']

      const result = await new InteractiveCLI(schema).resolveArgs()

      expect(result).toEqual({ name: 'Alice', env: 'production', verbose: undefined })
    })

    it('applies schema default when value is omitted and --no-prompt is set', async () => {
      process.argv = ['node', 'cli', '--name', 'Bob', '--no-prompt']

      const result = await new InteractiveCLI(schema).resolveArgs()

      expect(result.env).toBe('development')
    })

    it('leaves optional field undefined when omitted with --no-prompt', async () => {
      process.argv = ['node', 'cli', '--name', 'Eve', '--no-prompt']

      const result = await new InteractiveCLI(schema).resolveArgs()

      expect(result.verbose).toBeUndefined()
    })

    it('does not call any prompt when all fields are supplied via argv', async () => {
      // --verbose is a boolean flag; passing it sets cliArgs.verbose = true
      process.argv = ['node', 'cli', '--name', 'Alice', '--env', 'production', '--verbose']

      await new InteractiveCLI(schema).resolveArgs()

      expect(inputMock).not.toHaveBeenCalled()
      expect(selectMock).not.toHaveBeenCalled()
      expect(confirmMock).not.toHaveBeenCalled()
    })

    it('calls process.exit(1) when --no-prompt is set but a required field is missing', async () => {
      process.argv = ['node', 'cli', '--no-prompt'] // name is required, no default

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })

      await expect(new InteractiveCLI(schema).resolveArgs()).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  // -------------------------------------------------------------------------
  // resolveArgs — prompting
  // -------------------------------------------------------------------------

  describe('resolveArgs() — prompting', () => {
    it('calls inquirer input for missing string field', async () => {
      process.argv = ['node', 'cli', '--env', 'test']

      inputMock.mockResolvedValue('Charlie')

      const result = await new InteractiveCLI(schema).resolveArgs()

      expect(inputMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Your name' }),
      )
      expect(result.name).toBe('Charlie')
    })

    it('calls inquirer select for enum field and passes default value', async () => {
      process.argv = ['node', 'cli', '--name', 'Dave']

      selectMock.mockResolvedValue('production')

      const result = await new InteractiveCLI(schema).resolveArgs()

      expect(selectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Target environment',
          choices: [{ value: 'development' }, { value: 'production' }, { value: 'test' }],
          default: 'development',
        }),
      )
      expect(result.env).toBe('production')
    })

    it('calls inquirer confirm for boolean field', async () => {
      // z.boolean().optional() avoids Commander registering it as requiredOption
      const boolSchema = z.object({
        force: z.boolean().optional().describe('Force the operation'),
      })
      process.argv = ['node', 'cli']

      confirmMock.mockResolvedValue(true)

      const result = await new InteractiveCLI(boolSchema).resolveArgs()

      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Force the operation' }),
      )
      expect(result.force).toBe(true)
    })

    it('calls inquirer number for numeric field', async () => {
      const numSchema = z.object({
        port: z.number().describe('Port number'),
      })
      process.argv = ['node', 'cli']

      numberMock.mockResolvedValue(3000)

      const result = await new InteractiveCLI(numSchema).resolveArgs()

      expect(numberMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Port number' }),
      )
      expect(result.port).toBe(3000)
    })

    it('passes default value to input prompt for string field with default', async () => {
      const defaultSchema = z.object({
        host: z.string().default('localhost').describe('Host'),
      })
      process.argv = ['node', 'cli']

      inputMock.mockResolvedValue('localhost')

      await new InteractiveCLI(defaultSchema).resolveArgs()

      expect(inputMock).toHaveBeenCalledWith(
        expect.objectContaining({ default: 'localhost' }),
      )
    })

    it('uses schema default without prompting when boolean has a Zod default', async () => {
      // Commander receives the default value and sets opts().dryRun = false,
      // so the field is never "missing" — confirm() should NOT be called
      const defaultSchema = z.object({
        dryRun: z.boolean().optional().default(false).describe('Dry run'),
      })
      process.argv = ['node', 'cli']

      const result = await new InteractiveCLI(defaultSchema).resolveArgs()

      expect(confirmMock).not.toHaveBeenCalled()
      expect(result.dryRun).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // resolveArgs — error handling
  // -------------------------------------------------------------------------

  describe('resolveArgs() — error handling', () => {
    it('calls process.exit(1) and logs when prompt throws a non-zod error', async () => {
      process.argv = ['node', 'cli']

      inputMock.mockRejectedValue(new Error('TTY unavailable'))

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(new InteractiveCLI(schema).resolveArgs()).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('name'),
        expect.any(Error),
      )
    })

    it('calls process.exit(1) when an unsupported zod type is encountered', async () => {
      const unsupportedSchema = z.object({
        // ZodArray is not handled by promptUser
        tags: z.array(z.string()).describe('Tags'),
      })
      process.argv = ['node', 'cli']

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit')
      })
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(new InteractiveCLI(unsupportedSchema).resolveArgs()).rejects.toThrow()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})
