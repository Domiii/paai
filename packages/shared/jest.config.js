// packages/your-package-name/jest.config.js
const baseConfig = require('../../jest.config.base');

module.exports = {
  ...baseConfig,
  rootDir: __dirname,
  // Add any package-specific overrides here
};
