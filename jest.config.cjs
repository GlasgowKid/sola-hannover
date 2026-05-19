module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  // moduleNameMapper: {
  //   '^@app/(.*)$': '<rootDir>/src/app/$1' // Optional: Aliase aus tsconfig.json hier matchen
  // }
};