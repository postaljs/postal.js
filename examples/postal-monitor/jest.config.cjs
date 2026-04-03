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
                // import.meta is valid ESM but ts-jest uses CJS by default.
                // Suppress the TS1343 diagnostic so module-entry-point files
                // (launcher.ts, monitor.tsx) can be imported in tests without
                // triggering a false compile error.
                diagnostics: {
                    ignoreCodes: ["TS1343"],
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
