import { describe, expect, test } from "vitest";

import { validateBackupFile } from "../../src/pages/History";

describe("History", () => {
    test.each`
        data
        ${[]}
        ${[{ id: "1" }]}
        ${[{ id: "1" }, { id: "2" }]}
    `("should not throw for valid backup file: $data", ({ data }) => {
        validateBackupFile(data);
    });

    test.each`
        error                            | data
        ${"not an Array"}                | ${{}}
        ${"not an Array"}                | ${"test"}
        ${"not an Array"}                | ${1}
        ${"not all elements have an id"} | ${[{}]}
        ${"not all elements have an id"} | ${[{ id: undefined }]}
        ${"not all elements have an id"} | ${[{ id: null }]}
        ${"not all elements have an id"} | ${[{ id: "1" }, { noId: "2" }]}
    `("should throw for invalid backup file: $data", ({ data, error }) => {
        expect(() => validateBackupFile(data)).toThrow(error);
    });
});
