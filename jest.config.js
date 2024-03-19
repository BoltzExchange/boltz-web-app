module.exports = {
    preset: "solid-jest/preset/browser",
    setupFilesAfterEnv: ["<rootDir>/node_modules/@testing-library/jest-dom"],
    transformIgnorePatterns: ["node_modules/(?!@solidjs|solid-icons)"],
    moduleNameMapper: {
        "^.+\\.svg": "<rootDir>/tests/mocks/SvgMock.tsx",
        "^.+\\.css": "<rootDir>/tests/mocks/StylesMock.tsx",
        "^.+\\.scss": "<rootDir>/tests/mocks/StylesMock.tsx",
    },
    globals: {
        Buffer: Buffer,
        Uint8Array: Uint8Array,
        ArrayBuffer: ArrayBuffer,
    },
    setupFiles: ["./tests/setup.ts"],
};
