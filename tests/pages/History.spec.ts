import {
    invalidBackupFileError,
    validateBackupFile,
} from "../../src/pages/History";

describe("History", () => {
    test.each`
        data
        ${[]}
        ${[{ id: "1" }]}
        ${[{ id: "1" }, { id: "2" }]}
    `("should validate legacy backup files", ({ data }) => {
        expect(validateBackupFile(data)).toEqual({
            version: 0,
            swaps: data,
        });
    });

    test.each`
        data
        ${{ version: 1, swaps: [] }}
        ${{ version: 1, swaps: [{ id: "taproot" }] }}
    `("should validate new backup files", ({ data }) => {
        expect(validateBackupFile(data)).toEqual(data);
    });

    test.each`
        error                            | data
        ${invalidBackupFileError}        | ${{}}
        ${invalidBackupFileError}        | ${"test"}
        ${invalidBackupFileError}        | ${1}
        ${invalidBackupFileError}        | ${{ version: 1 }}
        ${invalidBackupFileError}        | ${{ swaps: [] }}
        ${"not all elements have an id"} | ${{ version: 1, swaps: [{ id: null }] }}
        ${"not all elements have an id"} | ${[{}]}
        ${"not all elements have an id"} | ${[{ id: undefined }]}
        ${"not all elements have an id"} | ${[{ id: null }]}
        ${"not all elements have an id"} | ${[{ id: "1" }, { noId: "2" }]}
    `("should throw for invalid backup file: $data", ({ data, error }) => {
        expect(() => validateBackupFile(data)).toThrow(error);
    });
});
