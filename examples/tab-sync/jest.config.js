module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    target: "ES2022",
                    module: "CommonJS",
                    moduleResolution: "node",
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
            },
        ],
    },
    transformIgnorePatterns: ["/node_modules/"],
};
