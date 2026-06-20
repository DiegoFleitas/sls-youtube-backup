/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/integration"],
  testMatch: ["**/*.integration.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 15000,
};
