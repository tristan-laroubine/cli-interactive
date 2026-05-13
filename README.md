# cli-interactive

> Schema-driven CLI toolkit — wraps Commander and Inquirer to serve power users (flags) and casual users (interactive prompts) from a single Zod schema.

[![npm version](https://img.shields.io/npm/v/cli-interactive)](https://www.npmjs.com/package/cli-interactive)
[![license](https://img.shields.io/npm/l/cli-interactive)](LICENSE)

## The idea

Most CLI tools force you to choose between two UX modes:

- **Flags-only** — great for power users and scripts, frustrating for newcomers who have to read the docs first.
- **Interactive wizards** — friendly for first-timers, annoying to automate.

`cli-interactive` bridges both worlds with a single [Zod](https://zod.dev) schema.

- You define *what* your CLI needs (field names, types, defaults, descriptions).
- **Power users** supply everything via flags — no prompts ever appear.
- **Casual users** just run the command with no arguments — they are guided through every missing field interactively.
- **Scripts / CI** pass `--no-prompt` to fail fast when a required value is absent instead of hanging on a prompt.

Internally the library wraps [Commander](https://github.com/tj/commander.js) for argument parsing and [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) for the interactive layer, so you get battle-tested behaviour without the boilerplate.

## Installation

```sh
npm install cli-interactive
```

## Quick start

```ts
import z from 'zod'
import { resolveArgs } from 'cli-interactive'

const schema = z.object({
  name: z.string().describe('Your name'),
  env: z
    .enum(['development', 'production', 'test'])
    .default('development')
    .describe('Target environment'),
  verbose: z.boolean().optional().describe('Enable verbose output'),
})

const args = await resolveArgs(schema)

console.log('Running as', args.name, 'in', args.env)
```

Then run it:

```sh
# Power-user mode — no prompts
node dist/index.js --name Alice --env production

# Casual mode — prompts for every missing field
node dist/index.js

# CI / script mode — exits with code 1 if a required field is missing
node dist/index.js --name Alice --no-prompt
```

## How field types map to prompts

| Zod type | Inquirer prompt |
|---|---|
| `z.string()` | `input` — free text |
| `z.number()` | `number` — numeric input |
| `z.boolean()` | `confirm` — yes / no |
| `z.enum([...])` | `select` — arrow-key list |
| `z.date()` | `input` — parsed as `new Date()` |

Wrap any type with `.optional()` or `.default(value)` to make it non-blocking; the prompt will pre-fill the default or skip validation when the user presses Enter.

## API

### `resolveArgs(schema): Promise<z.infer<typeof schema>>`

Parses `process.argv`, prompts for any missing fields, validates the combined result with Zod, and returns a fully-typed object.

| Parameter | Type | Description |
|---|---|---|
| `schema` | `z.ZodObject<...>` | Defines the fields, types, defaults, and descriptions shown in prompts and `--help`. |

Behaviour summary:

| Situation | Result |
|---|---|
| All fields supplied via flags | Returns immediately, no prompts |
| Some fields missing, no `--no-prompt` | Prompts only for the missing ones |
| `--no-prompt` and required field missing | Logs the validation error and calls `process.exit(1)` |
| Prompt throws (e.g. non-interactive TTY) | Logs the error and calls `process.exit(1)` |

### Built-in flags

| Flag | Effect |
|---|---|
| `--<field> <value>` | Supplies a value for the named field (auto-generated from the schema). |
| `--no-prompt` | Disables all interactive prompts. |
| `--help` | Prints usage information (provided by Commander). |

## Example — multiple field types

```ts
import z from 'zod'
import { resolveArgs } from 'cli-interactive'

const schema = z.object({
  username: z.string().describe('npm username'),
  port: z.number().default(3000).describe('Dev server port'),
  open: z.boolean().optional().describe('Open browser on start'),
  env: z
    .enum(['development', 'staging', 'production'])
    .default('development')
    .describe('Deployment target'),
})

const { username, port, open, env } = await resolveArgs(schema)
```

```sh
# Supply everything — zero prompts
node dist/index.js --username alice --port 4000 --env staging

# Supply nothing — guided step by step
node dist/index.js
# ? npm username › 
# ? Dev server port › (3000)
# ? Open browser on start › (y/N)
# ? Deployment target › (Use arrow keys)
#   development
# ❯ staging
#   production
```

## Requirements

- Node.js 22+
- TypeScript 6+
- `zod` ≥ 4.4

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

ISC
