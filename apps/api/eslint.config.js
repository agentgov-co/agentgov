import baseConfig from '@agentgov/eslint-config'

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'src/generated/**']
  }
]
