/* eslint-env node */
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "plugin:@typescript-eslint/stylistic",
  ],
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  root: true,
};
