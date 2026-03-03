# Contributing to vitallens.js

Thank you for your interest in contributing! This guide will help you set up your development environment and run the test suite.

## Development setup

We recommend using a specific Node.js version (Node 18+) to ensure compatibility.

### Clone and install

Clone the repository and install the dependencies.

```bash
# Clone the repo
git clone https://github.com/Rouast-Labs/vitallens.js.git
cd vitallens.js

# Install dependencies
# This installs all required packages for building and testing.
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