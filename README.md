# cli-interactive

> Interactive Command Line Interface

[![npm version](https://img.shields.io/npm/v/cli-interactive)](https://www.npmjs.com/package/cli-interactive)
[![license](https://img.shields.io/npm/l/cli-interactive)](LICENSE)

## Installation

```sh
npm install cli-interactive
```

## Usage

```ts
import { hello } from 'cli-interactive'

console.log(hello('world')) // Hello, world!
```

## Development

```sh
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Lint
npm run lint

# Type-check
npm run typecheck
```

## Commit convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).
Commit messages are enforced by [commitlint](https://commitlint.js.org/) via a Husky `commit-msg` hook.

```
feat: add new prompt component
fix: handle empty input correctly
docs: update README
```

## Publishing

Package publishing is guarded by `prepublishOnly`, which runs `typecheck`, `lint`, `test` and `build` in order before any publish.

### Authenticate with npm

```sh
npm login
```

### Publish a new version

```sh
# Bump version (patch | minor | major)
npm version patch

# Publish to npm registry
npm publish
```

> The `files` field in `package.json` ensures only the `dist/` folder is shipped to consumers.

### Publish a pre-release (e.g. beta)

```sh
npm version prerelease --preid=beta
npm publish --tag beta
```

### Dry run (inspect what will be published)

```sh
npm pack --dry-run
```

## License

ISC
