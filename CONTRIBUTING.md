# Contributing to vitallens.js

Thank you for your interest in contributing! This guide will help you set up your development environment and run the test suite.

## Development setup

We recommend using **Node 20 or higher** to ensure compatibility with our build tools and testing suite.

### Clone and install

Clone the repository and install the dependencies.

```bash
# Clone the repo
git clone https://github.com/Rouast-Labs/vitallens.js.git
cd vitallens.js

# Install dependencies
npm install
```

## Running tests

The test suite includes both unit tests (offline) and integration tests (online). Integration tests require a valid API Key to verify communication with the live API.

1. **Set the Environment Variable:**

If you plan to run integration tests, you must set the `API_KEY` environment variable.

```bash
# Mac/Linux
export API_KEY="your_api_key_here"

# Windows (PowerShell)
$env:API_KEY="your_api_key_here"
```

2. **Run the Suite:**

Execute all tests with a single command:

```bash
npm run test
```

### Targeted Testing

You can also run tests for specific environments:

```bash
# Run only Browser tests
npm run test:browser

# Run only Node.js tests
npm run test:node

# Run integration tests (Requires API_KEY)
npm run test:browser-integration
npm run test:node-integration
```

To run a specific test file:

```bash
npx vitest run test/core/VitalLens.browser.test.ts
```

To run a specific test file in watch mode (re-runs automatically when you save changes):

```bash
npx vitest test/core/VitalLens.browser.test.ts
```

## Linting

We use `eslint` to ensure code quality. Please check your code before submitting a PR.

```bash
npm run lint
```

## Building the package

To build the distribution bundles (ESM, CommonJS, and Browser) for publishing:

```bash
npm run build
```

The artifacts will be generated in the `dist/` directory.

## Releases

Releases are automated via GitHub Actions and triggered by git tags. All release activities should be performed on the `main` branch.

### 1. Prerelease (Beta)

Use this to test new features or major changes on the CDN/NPM without affecting stable users.

1. Merge your changes from `dev` to `main`.
2. Switch to `main` and pull: `git switch main && git pull`.
3. Create the beta version: `npm version 0.x.x-beta.x`.
4. Push with tags: `git push origin main --follow-tags`.

The CI will automatically publish to NPM with the `@beta` tag.

### 2. Production Release

1. Merge `dev` (or your beta fixes) to `main`.
2. Switch to `main` and pull: `git switch main && git pull`.
3. Create the stable version: `npm version patch` (or `minor`/`major`).
4. Push with tags: `git push origin main --follow-tags`.

The CI will publish this as the `latest` stable release.

### 3. Syncing back to Dev

After a release, ensure the version bump and tags are pulled back into your development branch:

```bash
git switch dev
git fetch origin
git pull --ff-only origin main
git push origin dev
```