module.exports = {
    preset: 'react-native',
    roots: [
        '<rootDir>'
    ],
    transform: {
      '\\.[ts]sx?$': '<rootDir>/node_modules/react-native/jest/preprocessor.js'
    },
    moduleNameMapper: { '^@src/(.*)$' : '<rootDir>/src/$1' },
    // This is the only part which you can keep
    // from the above linked tutorial's config:
    cacheDirectory: '.jest/cache',
};
  