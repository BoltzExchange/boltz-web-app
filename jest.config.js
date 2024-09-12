module.exports = {
    preset: "solid-jest/preset/browser",
    setupFilesAfterEnv: ["<rootDir>/node_modules/@testing-library/jest-dom"],
    transformIgnorePatterns: [
        "node_modules/(?!@solidjs|solid-icons|boltz-bolt12)",
    ],
    moduleNameMapper: {
        "^.+\\.svg": "<rootDir>/tests/mocks/SvgMock.tsx",
        "^.+\\.css": "<rootDir>/tests/mocks/StylesMock.tsx",
        "^.+\\.scss": "<rootDir>/tests/mocks/StylesMock.tsx",
        "boltz-bolt12": "<rootDir>/tests/mocks/bolt12.ts",
    },
    globals: {
        Buffer: Buffer,
        Uint8Array: Uint8Array,
        ArrayBuffer: ArrayBuffer,
    },
    setupFiles: ["./tests/setup.ts"],
};
