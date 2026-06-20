/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/e2e"],
  testMatch: ["**/*.e2e.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 30000,
};
