module.exports = {
  "roots": [
    // "<rootDir>/dist/test"
    "<rootDir>/src"
  ],
  "setupFiles": [
    // "<rootDir>/dist/test/test-setup/jest-setup.js"
    "<rootDir>/src/test-setup/jest-setup.js"
  ],
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json"
  ],
  "moduleNameMapper": {
    "^[./a-zA-Z0-9$_-]+\.css\!?$": "<rootDir>/src/test-setup/cssStub.js",
  },
  "testRegex": "(\\.|/)(test|spec)\\.(jsx?|tsx?)$",
  "transform": {
    "^.+\\.js$": "babel-jest",
    "^.+\\.(ts|tsx)$": "ts-jest"
  },
  "coverageDirectory": "<rootDir>/tmp/coverage/node/",
  "collectCoverage": false,
  "testEnvironment": "jest-environment-jsdom-fifteen",
  "globals": {
    "ts-jest": {
      "tsConfig": "tsconfig.test.json"
    }
  }
};
