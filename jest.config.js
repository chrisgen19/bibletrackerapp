/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Tests live beside the code they cover, but never inside the Expo Router
  // `src/app` directory — files there are routes, not test targets.
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/src/app/'],
  collectCoverageFrom: [
    'src/**/domain/**/*.ts',
    'src/utils/**/*.ts',
    '!src/**/__tests__/**',
  ],
};
