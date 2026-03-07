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

Releases are automated via GitHub Actions and triggered by git tags.

### 1. Prerelease (Beta)

Use this to test new features or major changes on the CDN/NPM without affecting stable users.

1. Get your changes into `main` (e.g., merge your `dev` PR on GitHub).
2. Switch to `main` locally and pull the latest:
  ```bash
  git switch main
  git pull origin main
  ```
3. Bump the version:
  ```bash
  npm version prerelease --preid=beta
  ```
4. Push the version commit and the new tag directly to `main`:
  ```bash
  git push origin main --follow-tags
  ```

The CI will automatically publish to NPM with the `@beta` tag.

### 2. Production Release

1. Get your final changes into `main`.
2. Switch to `main` locally and pull the latest:
  ```bash
  git switch main
  git pull origin main
  ```
3. Bump the version:
  ```bash
  npm version patch # or minor/major
  ```
4. Push the version commit and the new tag directly to `main`:
  ```bash
  git push origin main --follow-tags
  ```

The CI will publish this as the `latest` stable release.

### 3. Syncing back to Dev

After any release, ensure the version bump commit and tags are merged back into your development branch:

```bash
git switch dev
git merge main
git push origin dev
```