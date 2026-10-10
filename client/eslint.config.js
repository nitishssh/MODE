const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([expo, {
  ignores: ['dist/**', 'src/generated/**'],
  rules: {
    // Network hydration intentionally updates state after an async response.
    'react-hooks/set-state-in-effect': 'off',
    // Expo Google Fonts exposes font-weight subpaths that this resolver cannot discover.
    'import/no-unresolved': ['error', { ignore: ['^@expo-google-fonts/'] }],
  },
}]);
