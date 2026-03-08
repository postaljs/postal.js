module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    jsx: "react-jsx",
                    esModuleInterop: true,
                },
            },
        ],
    },
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        // Strip .js extensions so Jest finds the .ts source files.
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transformIgnorePatterns: ["/node_modules/"],
};
