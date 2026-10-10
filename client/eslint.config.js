const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");
module.exports = defineConfig([expoConfig, {
  rules: {
    // Network hydration intentionally updates state after an async response.
    "react-hooks/set-state-in-effect": "off"
  }
}]);
