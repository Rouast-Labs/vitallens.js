const { FlatCompat } = require('@eslint/eslintrc')
const globals = require('globals')
const js = require('@eslint/js')

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended
})

module.exports = [
  js.configs.recommended,
  ...compat.extends(
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ),
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
      globals: { ...globals.browser, ...globals.node }
    }
  }
]
