module.exports = {
    preset: 'ts-jest',
    testTimeout: 900000, // 15 minutes to allow for aggregation polling
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.(spec|test).+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
    testPathIgnorePatterns: [
        '<rootDir>/src/__tests__/test-config.ts',
        '<rootDir>/src/__tests__/helpers/',
    ],
}
