module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['dist/', 'node_modules/', '.expo/'],
  rules: {
    // The domain layer is the contract the rest of the app depends on; an
    // unused export there is usually a leftover, not an extension point.
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
